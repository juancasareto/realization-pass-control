-- AlterTable
ALTER TABLE "Retiro" ADD COLUMN     "categoria" TEXT;

-- CreateTable
CREATE TABLE "IngresoManual" (
    "id" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "medio" "MedioPago" NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "descripcion" TEXT,
    "clienteId" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngresoManual_pkey" PRIMARY KEY ("id")
);
