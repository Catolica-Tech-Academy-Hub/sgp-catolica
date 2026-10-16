-- CreateTable
CREATE TABLE `usuarios` (
    `id` VARCHAR(64) NOT NULL,
    `role` ENUM('professor', 'estudante') NOT NULL,
    `fullName` VARCHAR(160) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `passwordHash` VARCHAR(255) NULL,
    `registration` VARCHAR(32) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `anonymizedAt` DATETIME(3) NULL,

    UNIQUE INDEX `usuarios_email_key`(`email`),
    UNIQUE INDEX `usuarios_registration_key`(`registration`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `turmas` (
    `id` VARCHAR(64) NOT NULL,
    `teacherId` VARCHAR(64) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `subject` VARCHAR(160) NOT NULL,
    `term` VARCHAR(16) NOT NULL,
    `status` ENUM('active', 'archived') NOT NULL DEFAULT 'active',
    `inviteCode` VARCHAR(32) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `turmas_inviteCode_key`(`inviteCode`),
    INDEX `turmas_teacherId_idx`(`teacherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `matriculas` (
    `id` VARCHAR(64) NOT NULL,
    `classId` VARCHAR(64) NOT NULL,
    `studentId` VARCHAR(64) NOT NULL,
    `enrolledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('active', 'removed') NOT NULL DEFAULT 'active',
    `enrolledVia` ENUM('teacher', 'invite_code') NOT NULL,

    UNIQUE INDEX `matriculas_classId_studentId_key`(`classId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questoes` (
    `id` VARCHAR(64) NOT NULL,
    `teacherId` VARCHAR(64) NOT NULL,
    `type` ENUM('objetiva', 'discursiva') NOT NULL,
    `statement` TEXT NOT NULL,
    `tags` JSON NOT NULL,
    `correctAlternativeId` VARCHAR(64) NULL,
    `maxScore` DECIMAL(6, 2) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `questoes_teacherId_deletedAt_idx`(`teacherId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alternativas` (
    `id` VARCHAR(64) NOT NULL,
    `questionId` VARCHAR(64) NOT NULL,
    `text` TEXT NOT NULL,
    `position` INTEGER NOT NULL,

    UNIQUE INDEX `alternativas_questionId_position_key`(`questionId`, `position`),
    PRIMARY KEY (`questionId`, `id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provas` (
    `id` VARCHAR(64) NOT NULL,
    `teacherId` VARCHAR(64) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('draft', 'ready', 'closed') NOT NULL DEFAULT 'draft',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `provas_teacherId_idx`(`teacherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questoes_da_prova` (
    `examId` VARCHAR(64) NOT NULL,
    `questionId` VARCHAR(64) NOT NULL,
    `order` INTEGER NOT NULL,
    `score` DECIMAL(6, 2) NOT NULL,

    PRIMARY KEY (`examId`, `questionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `aplicacoes` (
    `id` VARCHAR(64) NOT NULL,
    `examId` VARCHAR(64) NOT NULL,
    `classId` VARCHAR(64) NOT NULL,
    `teacherId` VARCHAR(64) NOT NULL,
    `status` ENUM('draft', 'generated', 'closed') NOT NULL DEFAULT 'draft',
    `pdfUrl` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `aplicacoes_teacherId_idx`(`teacherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `versoes_prova` (
    `id` VARCHAR(64) NOT NULL,
    `applicationId` VARCHAR(64) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `shuffleQuestions` BOOLEAN NOT NULL,
    `shuffleAlternatives` BOOLEAN NOT NULL,
    `withStudentIdentification` BOOLEAN NOT NULL,
    `layout` JSON NOT NULL,
    `answerKeyPublished` BOOLEAN NOT NULL DEFAULT false,
    `answerKeyPublishedAt` DATETIME(3) NULL,
    `publicCode` VARCHAR(32) NOT NULL,
    `qrCodePayload` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `versoes_prova_publicCode_key`(`publicCode`),
    UNIQUE INDEX `versoes_prova_qrCodePayload_key`(`qrCodePayload`),
    UNIQUE INDEX `versoes_prova_applicationId_versionNumber_key`(`applicationId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `atribuicoes_versao` (
    `id` VARCHAR(64) NOT NULL,
    `examVersionId` VARCHAR(64) NOT NULL,
    `studentId` VARCHAR(64) NOT NULL,
    `qrCodePayload` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `atribuicoes_versao_qrCodePayload_key`(`qrCodePayload`),
    UNIQUE INDEX `atribuicoes_versao_examVersionId_studentId_key`(`examVersionId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `correcoes` (
    `id` VARCHAR(64) NOT NULL,
    `examVersionId` VARCHAR(64) NOT NULL,
    `studentId` VARCHAR(64) NULL,
    `reportedStudentName` VARCHAR(160) NULL,
    `reportedStudentRegistration` VARCHAR(32) NULL,
    `objectiveResults` JSON NOT NULL,
    `discursiveScores` JSON NOT NULL,
    `totalScore` DECIMAL(6, 2) NOT NULL,
    `notes` TEXT NULL,
    `confirmedAt` DATETIME(3) NOT NULL,
    `correctedBy` VARCHAR(64) NOT NULL,
    `isAutomaticallyAssigned` BOOLEAN NOT NULL,
    `clientCorrectionId` VARCHAR(64) NOT NULL,
    `syncStatus` ENUM('pending', 'synced', 'error') NOT NULL DEFAULT 'synced',

    UNIQUE INDEX `correcoes_clientCorrectionId_key`(`clientCorrectionId`),
    INDEX `correcoes_examVersionId_idx`(`examVersionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `turmas` ADD CONSTRAINT `turmas_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matriculas` ADD CONSTRAINT `matriculas_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `turmas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matriculas` ADD CONSTRAINT `matriculas_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questoes` ADD CONSTRAINT `questoes_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alternativas` ADD CONSTRAINT `alternativas_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questoes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provas` ADD CONSTRAINT `provas_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questoes_da_prova` ADD CONSTRAINT `questoes_da_prova_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `provas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questoes_da_prova` ADD CONSTRAINT `questoes_da_prova_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aplicacoes` ADD CONSTRAINT `aplicacoes_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `provas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aplicacoes` ADD CONSTRAINT `aplicacoes_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `turmas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aplicacoes` ADD CONSTRAINT `aplicacoes_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `versoes_prova` ADD CONSTRAINT `versoes_prova_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `aplicacoes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `atribuicoes_versao` ADD CONSTRAINT `atribuicoes_versao_examVersionId_fkey` FOREIGN KEY (`examVersionId`) REFERENCES `versoes_prova`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `atribuicoes_versao` ADD CONSTRAINT `atribuicoes_versao_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `correcoes` ADD CONSTRAINT `correcoes_examVersionId_fkey` FOREIGN KEY (`examVersionId`) REFERENCES `versoes_prova`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `correcoes` ADD CONSTRAINT `correcoes_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `correcoes` ADD CONSTRAINT `correcoes_correctedBy_fkey` FOREIGN KEY (`correctedBy`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

