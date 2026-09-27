FROM php:8.3-apache-bookworm

# PHP's Apache setup must use exactly one MPM. Remove every enabled MPM
# and then enable only prefork (required for mod_php).
RUN a2dismod mpm_event mpm_worker mpm_prefork 2>/dev/null || true \
    && rm -f /etc/apache2/mods-enabled/mpm_*.load /etc/apache2/mods-enabled/mpm_*.conf \
    && a2enmod mpm_prefork rewrite headers expires \
    && docker-php-ext-install pdo_mysql

WORKDIR /var/www/html
COPY . /var/www/html/

RUN chown -R www-data:www-data /var/www/html \
    && find /var/www/html -type d -exec chmod 755 {} \; \
    && find /var/www/html -type f -exec chmod 644 {} \;

EXPOSE 80

CMD ["apache2-foreground"]
