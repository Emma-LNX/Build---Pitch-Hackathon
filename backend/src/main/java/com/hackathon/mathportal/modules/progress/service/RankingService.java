package com.hackathon.mathportal.modules.progress.service;

import com.hackathon.mathportal.common.PageResponse;
import com.hackathon.mathportal.modules.progress.dto.ProgressDtos.RankingEntry;
import com.hackathon.mathportal.modules.progress.repository.RankingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RankingService {
    private final RankingRepository rankings;

    public RankingService(RankingRepository rankings) { this.rankings = rankings; }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public PageResponse<RankingEntry> ranking(int page, int size) { return rankings.findPage(page, size); }
}
