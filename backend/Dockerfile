# Imagen única para desarrollo local. Para producción se compila con
# `npm run build` y se arranca con `npm start` sobre una imagen slim.
FROM node:22-alpine

WORKDIR /app

# Se copia solo el manifiesto primero para que la capa de dependencias
# se cachee y no se reinstale en cada cambio de código.
COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

EXPOSE 8080

CMD ["npm", "run", "dev"]
