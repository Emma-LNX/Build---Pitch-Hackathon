package com.hackathon.mathportal.modules.progress.controller;

import com.hackathon.mathportal.modules.progress.dto.ProgressDtos.*;
import com.hackathon.mathportal.modules.progress.service.AttemptService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/attempts")
public class AttemptController {
    private final AttemptService attempts;

    public AttemptController(AttemptService attempts) { this.attempts = attempts; }

    // 200 for both first submissions and idempotent retries.
    @PostMapping
    public AttemptResult submit(@Valid @RequestBody SubmitAttempt request) { return attempts.submit(request); }
}
