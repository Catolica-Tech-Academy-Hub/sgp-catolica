-- Sincronizacao das correcoes do aplicativo (RF08, issue #94): snapshot do gabarito usado,
-- motivo de revisao e uma correcao por estudante e versao.
-- AlterTable
ALTER TABLE `correcoes` ADD COLUMN `answerKeySnapshot` JSON NULL,
    ADD COLUMN `reviewReason` ENUM('answer_key_changed', 'duplicate_submission') NULL;

-- CreateIndex
CREATE UNIQUE INDEX `correcoes_examVersionId_studentId_key` ON `correcoes`(`examVersionId`, `studentId`);

