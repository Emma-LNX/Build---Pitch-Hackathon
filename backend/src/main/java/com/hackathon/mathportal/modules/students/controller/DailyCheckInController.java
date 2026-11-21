package com.hackathon.mathportal.modules.students.controller;

import com.hackathon.mathportal.modules.students.dto.DailyCheckInDtos.*;
import com.hackathon.mathportal.modules.students.service.DailyCheckInService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/students/me/daily-check-in")
public class DailyCheckInController {
    private final DailyCheckInService service;
    public DailyCheckInController(DailyCheckInService service) { this.service = service; }

    @GetMapping
    public Today today() { return service.today(); }

    @PostMapping
    public Entry submit(@Valid @RequestBody Answers request) { return service.submit(request); }

    @PostMapping("/sync")
    public Entry sync(@Valid @RequestBody OfflineAnswers request) { return service.sync(request); }
}
