# Multi-stage build for the ASP.NET Core inventory-service.
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app
COPY InventoryService.csproj ./
RUN dotnet restore
COPY . ./
RUN dotnet publish -c Release -o /out

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /out ./
EXPOSE 3029
ENTRYPOINT ["dotnet", "InventoryService.dll"]
