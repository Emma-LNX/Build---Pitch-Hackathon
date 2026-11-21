package com.hackathon.mathportal.modules.parents.service;

import com.hackathon.mathportal.modules.parents.mail.ReportEmailSender;
import com.hackathon.mathportal.modules.parents.repository.ParentRepository;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class WeeklyReportScheduler {
    private static final Logger LOG = LoggerFactory.getLogger(WeeklyReportScheduler.class);
    private final ParentRepository parents;
    private final ParentService reports;
    private final ReportEmailSender emailSender;
    private final Clock clock;
    private final ZoneId zone;

    public WeeklyReportScheduler(ParentRepository parents, ParentService reports,
            ReportEmailSender emailSender, Clock clock,
            @Value("${REPORT_WEEKLY_ZONE:America/Guatemala}") String zone) {
        this.parents = parents;
        this.reports = reports;
        this.emailSender = emailSender;
        this.clock = clock;
        this.zone = ZoneId.of(zone);
    }

    // Se revisa diariamente para reintentar fallos; la marca de envío limita cada contacto a una vez por semana.
    @Scheduled(cron = "${REPORT_WEEKLY_CHECK_CRON:0 0 8 * * *}", zone = "${REPORT_WEEKLY_ZONE:America/Guatemala}")
    public void run() { runAt(clock.instant()); }

    public void runAt(Instant instant) {
        if (!emailSender.isConfigured()) return;
        Instant now = instant.truncatedTo(ChronoUnit.MICROS);
        LocalDate monday = LocalDate.ofInstant(now, zone)
            .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        Instant weekStart = monday.atStartOfDay(zone).toInstant();
        Instant expiredBefore = now.minus(15, ChronoUnit.MINUTES);
        for (var target : parents.dueForWeekly(weekStart)) {
            if (!parents.claimWeekly(target.parentId(), weekStart, now, expiredBefore)) continue;
            try {
                reports.sendReportAt(target.teacherId(), target.schoolId(), target.classroomId(),
                    target.studentId(), target.parentId(), now);
            } catch (RuntimeException exception) {
                LOG.warn("No se pudo enviar el reporte semanal del contacto {}. Se reintentará en la próxima revisión.",
                    target.parentId());
            } finally {
                parents.releaseWeekly(target.parentId(), now);
            }
        }
    }
}
