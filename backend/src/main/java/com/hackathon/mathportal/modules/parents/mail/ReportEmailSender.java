package com.hackathon.mathportal.modules.parents.mail;

import java.util.Properties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class ReportEmailSender {
    private final String host;
    private final int port;
    private final String username;
    private final String password;
    private final String from;
    private final boolean startTls;

    public ReportEmailSender(@Value("${REPORT_SMTP_HOST:}") String host,
            @Value("${REPORT_SMTP_PORT:587}") int port,
            @Value("${REPORT_SMTP_USERNAME:}") String username,
            @Value("${REPORT_SMTP_PASSWORD:}") String password,
            @Value("${REPORT_SMTP_FROM:}") String from,
            @Value("${REPORT_SMTP_STARTTLS:true}") boolean startTls) {
        this.host = host;
        this.port = port;
        this.username = username;
        this.password = password;
        this.from = from;
        this.startTls = startTls;
    }

    public void send(String recipient, String subject, String body) {
        if (!isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Configura el SMTP de reportes antes de enviar correos");
        }
        var sender = new JavaMailSenderImpl();
        sender.setHost(host);
        sender.setPort(port);
        sender.setUsername(username);
        sender.setPassword(password);
        Properties properties = sender.getJavaMailProperties();
        properties.put("mail.smtp.auth", Boolean.toString(!username.isBlank()));
        properties.put("mail.smtp.starttls.enable", Boolean.toString(startTls));
        properties.put("mail.smtp.connectiontimeout", "5000");
        properties.put("mail.smtp.timeout", "5000");
        properties.put("mail.smtp.writetimeout", "5000");

        var message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(recipient);
        message.setSubject(subject);
        message.setText(body);
        try {
            sender.send(message);
        } catch (MailException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "No se pudo enviar el reporte por correo");
        }
    }

    public boolean isConfigured() { return !host.isBlank() && !from.isBlank(); }
}
