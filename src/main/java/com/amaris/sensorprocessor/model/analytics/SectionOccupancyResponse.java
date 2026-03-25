package com.amaris.sensorprocessor.model.analytics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SectionOccupancyResponse {
    private String sectionName;
    private List<OccupancyStats> sensorStats;
    
    // Global stats for the section
    private OccupancyStats globalStats;
    
    // Metadata
    private String calculationMethod;
    private String businessHours;
    private String workingDays;
}
