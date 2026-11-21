package com.hackathon.mathportal;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class MathPortalApplication {
    public static void main(String[] args) {
        SpringApplication.run(MathPortalApplication.class, args);
    }
}
