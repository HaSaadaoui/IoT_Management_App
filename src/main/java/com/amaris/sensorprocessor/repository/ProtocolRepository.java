package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.Protocol;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProtocolRepository extends JpaRepository<Protocol, Integer> {
}