package com.hackathon.mathportal.modules.Estadistica;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
@Repository
public class EstadisticasRepository {

    private final JdbcTemplate jdbcTemplate;

    public EstadisticasRepository(DataSource dataSource) {
        this.jdbcTemplate = new JdbcTemplate(dataSource);
    }

    public boolean comprobarConexion() {
        Integer resultado = jdbcTemplate.queryForObject(
            "SELECT 1",
            Integer.class
        );
        return Integer.valueOf(1).equals(resultado);
    }
}