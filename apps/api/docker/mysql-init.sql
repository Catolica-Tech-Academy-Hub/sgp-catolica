-- So para o MySQL de desenvolvimento: `prisma migrate dev` cria um banco temporario
-- (shadow database) para detectar divergencias, e o usuario `sgp` precisa poder cria-lo.
GRANT ALL PRIVILEGES ON *.* TO 'sgp'@'%';
FLUSH PRIVILEGES;
