package com.hackathon.mathportal.modules.students.controller;

import com.hackathon.mathportal.modules.students.dto.StudentDtos.*;
import com.hackathon.mathportal.modules.students.service.StudentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/students/me")
public class StudentController {
    private final StudentService students;

    public StudentController(StudentService students) { this.students = students; }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Profile create(@Valid @RequestBody Create request) { return students.create(request); }

    @GetMapping
    public Profile profile() { return students.getProfile(); }

    @PatchMapping
    public Profile patch(@Valid @RequestBody Patch request) { return students.patch(request); }
}
