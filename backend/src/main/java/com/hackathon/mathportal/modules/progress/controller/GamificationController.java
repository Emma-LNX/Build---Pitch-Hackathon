package com.hackathon.mathportal.modules.progress.controller;

import com.hackathon.mathportal.common.PageResponse;
import com.hackathon.mathportal.modules.progress.dto.ProgressDtos.*;
import com.hackathon.mathportal.modules.progress.service.ProgressService;
import com.hackathon.mathportal.modules.progress.service.RankingService;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
public class GamificationController {
    private final ProgressService progress;
    private final RankingService rankings;

    public GamificationController(ProgressService progress, RankingService rankings) {
        this.progress = progress;
        this.rankings = rankings;
    }

    @GetMapping("/levels")
    public List<LevelView> levels() { return progress.levels(); }

    @GetMapping("/ranking")
    public PageResponse<RankingEntry> ranking(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) { return rankings.ranking(page, size); }
}
