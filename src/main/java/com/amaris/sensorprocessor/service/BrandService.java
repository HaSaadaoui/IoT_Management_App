package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.Brand;
import com.amaris.sensorprocessor.repository.BrandRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class BrandService {

    private final BrandRepository brandRepository;

    public BrandService(BrandRepository brandRepository) {
        this.brandRepository = brandRepository;
    }

    public List<Brand> findAll() {
        return brandRepository.findAll(Sort.by(Sort.Direction.ASC, "name"));
    }
}