package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.model.analytics.SectionOccupancyResponse;
import com.amaris.sensorprocessor.service.OccupancyAnalyticsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
@Slf4j
public class OccupancyAnalyticsController {

    private final OccupancyAnalyticsService analyticsService;

    /**
     * Get occupancy analytics for a specific section
     * @param section Section type: desk, meeting, phone, interview
     * @return Occupancy statistics for all sensors in the section
     */
    @GetMapping("/occupancy/{section}")
    public ResponseEntity<SectionOccupancyResponse> getSectionOccupancy(@PathVariable String section) {
        log.info("Getting occupancy analytics for section: {}", section);
        
        try {
            SectionOccupancyResponse response = analyticsService.getSectionOccupancy(section);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error getting occupancy analytics for section {}: {}", section, e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get all sections occupancy analytics
     * @return All sections occupancy statistics
     */
    @GetMapping("/occupancy/all")
    public ResponseEntity<?> getAllSectionsOccupancy() {
        log.info("Getting occupancy analytics for all sections");
        
        try {
            var desk = analyticsService.getSectionOccupancy("desk");
            var meeting = analyticsService.getSectionOccupancy("meeting");
            var phone = analyticsService.getSectionOccupancy("phone");
            var interview = analyticsService.getSectionOccupancy("interview");
            
            return ResponseEntity.ok(new java.util.HashMap<String, SectionOccupancyResponse>() {{
                put("desk", desk);
                put("meeting", meeting);
                put("phone", phone);
                put("interview", interview);
            }});
        } catch (Exception e) {
            log.error("Error getting all occupancy analytics: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }
}
