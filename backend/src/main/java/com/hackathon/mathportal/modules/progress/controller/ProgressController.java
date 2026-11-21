package com.hackathon.mathportal.modules.progress.controller;

import com.hackathon.mathportal.common.PageResponse;
import com.hackathon.mathportal.modules.progress.dto.ProgressDtos.*;
import com.hackathon.mathportal.modules.progress.service.ProgressService;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/students/me")
public class ProgressController {
    private final ProgressService progress;

    public ProgressController(ProgressService progress) { this.progress = progress; }

    @GetMapping("/progress")
    public Summary summary() { return progress.mine(); }

    @GetMapping("/activities/{activityId}/progress")
    public ActivityProgressView activity(@PathVariable UUID activityId) { return progress.activity(activityId); }

    @GetMapping("/attempts")
    public PageResponse<AttemptView> history(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) { return progress.history(page, size); }
}
