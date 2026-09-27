FROM php:8.3-apache-bookworm

# Use Apache prefork with mod_php and enable SQLite for a zero-service deployment.
RUN docker-php-ext-install pdo_sqlite \
    && a2dismod mpm_event mpm_worker 2>/dev/null || true

RUN a2enmod mpm_prefork rewrite headers expires

WORKDIR /var/www/html
COPY . /var/www/html/

RUN mkdir -p /var/www/html/storage \
    && chown -R www-data:www-data /var/www/html \
    && find /var/www/html -type d -exec chmod 755 {} \; \
    && chmod 775 /var/www/html/storage \
    && find /var/www/html -type f -exec chmod 644 {} \;

EXPOSE 80

CMD ["apache2-foreground"]
