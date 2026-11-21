package com.hackathon.mathportal.modules.progress.repository;

import com.hackathon.mathportal.common.PageResponse;
import com.hackathon.mathportal.modules.progress.dto.ProgressDtos.*;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class RankingRepository {
    private final JdbcTemplate jdbc;

    public RankingRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public PageResponse<RankingEntry> findPage(int page, int size) {
        var pageable = PageResponse.request(page, size);
        // Rank the complete eligible population before applying pagination.
        var entries = jdbc.query("""
            WITH totals AS (
                SELECT a.id, a.alias, sum(p.cantidad)::bigint AS xp
                FROM math_portal.alumnos a
                JOIN math_portal.movimientos_puntos p ON p.alumno_id = a.id
                WHERE a.estado = 'ACTIVO' AND a.participa_ranking
                GROUP BY a.id, a.alias
            ), ranked AS (
                SELECT *, rank() OVER (ORDER BY xp DESC) AS position FROM totals
            )
            SELECT r.alias, r.xp, r.position, l.id AS level_id, l.numero, l.nombre, l.xp_minimos
            FROM ranked r
            CROSS JOIN LATERAL (
                SELECT * FROM math_portal.niveles_alumno n WHERE n.xp_minimos <= r.xp
                ORDER BY n.xp_minimos DESC LIMIT 1
            ) l
            ORDER BY r.xp DESC, r.id ASC
            LIMIT ? OFFSET ?
            """, (rs, row) -> new RankingEntry(rs.getString("alias"),
                new LevelView(rs.getObject("level_id", UUID.class), rs.getInt("numero"),
                    rs.getString("nombre"), rs.getLong("xp_minimos")),
                rs.getLong("xp"), rs.getLong("position")), size, pageable.getOffset());
        Long total = jdbc.queryForObject("""
            SELECT count(*) FROM math_portal.alumnos a
            WHERE a.estado = 'ACTIVO' AND a.participa_ranking
              AND EXISTS (SELECT 1 FROM math_portal.movimientos_puntos p WHERE p.alumno_id = a.id)
            """, Long.class);
        long count = total == null ? 0 : total;
        return new PageResponse<>(entries, page, size, count, (count + size - 1) / size);
    }
}
