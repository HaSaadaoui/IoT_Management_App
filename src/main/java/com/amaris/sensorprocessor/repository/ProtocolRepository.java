package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.Protocol;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ProtocolRepository extends JpaRepository<Protocol, Integer> {

    boolean existsByName(String name);
    List<Protocol> findAll(Sort sort);

    @Query("SELECT p FROM Protocol p WHERE p.availableForGateway = true")
    List<Protocol> findByAvailableForGatewayTrue(Sort sort);
}