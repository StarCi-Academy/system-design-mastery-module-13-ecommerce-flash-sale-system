package com.starci.inventory;

import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface InventoryRepository extends JpaRepository<InventoryEntity, String> {

    // PESSIMISTIC_WRITE makes Spring Data JPA emit SELECT ... FOR UPDATE,
    // placing a row-level write lock on this SKU's inventory row.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM InventoryEntity i WHERE i.sku = :sku")
    Optional<InventoryEntity> findBySkuForUpdate(@Param("sku") String sku);
}

interface InventoryLedgerRepository extends JpaRepository<InventoryLedgerEntity, Long> {
    List<InventoryLedgerEntity> findBySkuOrderByIdAsc(String sku);
}
