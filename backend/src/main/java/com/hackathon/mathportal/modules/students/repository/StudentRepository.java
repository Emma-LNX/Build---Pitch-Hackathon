package com.hackathon.mathportal.modules.students.repository;

import com.hackathon.mathportal.modules.students.entity.Student;
import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentRepository extends JpaRepository<Student, UUID> {
    Optional<Student> findByAuthSubject(String authSubject);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Student s where s.authSubject = :subject")
    Optional<Student> findForUpdate(@Param("subject") String subject);
}

