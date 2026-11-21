package com.hackathon.mathportal.common;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public record PageResponse<T>(List<T> content, int page, int size, long totalElements, long totalPages) {
    public static PageRequest request(int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "page debe ser >= 0, size entre 1 y 100 y el desplazamiento no puede superar 2147483647");
        }
        return PageRequest.of(page, size);
    }

    public static <T> PageResponse<T> from(Page<T> result) {
        return new PageResponse<>(result.getContent(), result.getNumber(), result.getSize(),
            result.getTotalElements(), result.getTotalPages());
    }
}
