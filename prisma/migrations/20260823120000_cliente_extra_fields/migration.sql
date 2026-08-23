-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "contactoEmergenciaNombre" TEXT,
ADD COLUMN     "contactoEmergenciaTel" TEXT,
ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "dni" TEXT,
ADD COLUMN     "fechaNacimiento" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_dni_key" ON "Cliente"("dni");
