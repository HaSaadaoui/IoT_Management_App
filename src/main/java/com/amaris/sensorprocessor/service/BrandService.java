package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.Brand;
import com.amaris.sensorprocessor.repository.BrandRepository;
import org.springframework.dao.DataIntegrityViolationException;
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

    public Brand createByName(String name) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Brand name is required");
        }

        String cleaned = name.trim();

        Brand brand = new Brand();
        brand.setName(cleaned);

        try {
            return brandRepository.save(brand);
        } catch (DataIntegrityViolationException e) {
            throw new IllegalStateException("Brand already exists: " + cleaned);
        }
    }

    public void deleteById(Integer id) {
        brandRepository.deleteById(id);
    }
}