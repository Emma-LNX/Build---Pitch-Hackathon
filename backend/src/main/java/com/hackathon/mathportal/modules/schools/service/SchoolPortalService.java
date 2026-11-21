package com.hackathon.mathportal.modules.schools.service;

import java.util.List;
import java.util.UUID;
import com.hackathon.mathportal.modules.auth.dto.SchoolRole;
import com.hackathon.mathportal.modules.auth.repository.MembershipRepository;
import com.hackathon.mathportal.modules.courses.dto.CourseView;
import com.hackathon.mathportal.modules.schools.dto.SchoolView;
import com.hackathon.mathportal.modules.topics.dto.CreateTopicRequest;
import com.hackathon.mathportal.modules.topics.dto.TopicView;
import com.hackathon.mathportal.modules.topics.repository.SchoolTopicRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class SchoolPortalService {
    private final MembershipRepository memberships;
    private final SchoolTopicRepository topics;

    public SchoolPortalService(MembershipRepository memberships, SchoolTopicRepository topics) {
        this.memberships = memberships;
        this.topics = topics;
    }

    public List<SchoolView> schools(UUID userId) { return memberships.schoolsFor(userId); }

    public List<CourseView> courses(UUID userId, UUID schoolId) {
        if (!memberships.belongsToSchool(userId, schoolId)) throw notFound();
        return memberships.coursesFor(userId, schoolId);
    }

    public List<TopicView> topics(UUID userId, UUID schoolId, UUID courseId) {
        requireCourse(userId, schoolId, courseId);
        return topics.findForMember(userId, schoolId, courseId);
    }

    @Transactional
    public TopicView createTopic(UUID userId, UUID schoolId, UUID courseId, CreateTopicRequest request) {
        if (requireCourse(userId, schoolId, courseId) != SchoolRole.PROFESOR) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo el profesor asignado puede crear temas");
        }
        return topics.createForTeacher(userId, schoolId, courseId, request).orElseThrow(SchoolPortalService::notFound);
    }

    private SchoolRole requireCourse(UUID userId, UUID schoolId, UUID courseId) {
        return memberships.courseRole(userId, schoolId, courseId).orElseThrow(SchoolPortalService::notFound);
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Recurso no disponible");
    }
}
