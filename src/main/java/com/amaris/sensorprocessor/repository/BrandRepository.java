package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.Brand;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrandRepository extends JpaRepository<Brand, Integer> {
}