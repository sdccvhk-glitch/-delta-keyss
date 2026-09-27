FROM php:8.3-apache-bookworm

# This app uses PHP + SQLite, so Apache must run with exactly one MPM.
# The base image may already have an MPM enabled; remove every MPM first,
# then enable only prefork for mod_php.
RUN docker-php-ext-install pdo_sqlite \
    && a2dismod mpm_event mpm_worker mpm_prefork 2>/dev/null || true \
    && rm -f /etc/apache2/mods-enabled/mpm_*.load /etc/apache2/mods-enabled/mpm_*.conf \
    && a2enmod mpm_prefork rewrite headers expires \
    && apache2ctl -M | grep -q 'mpm_prefork_module'

WORKDIR /var/www/html
COPY . /var/www/html/

RUN mkdir -p /var/www/html/storage \
    && chown -R www-data:www-data /var/www/html \
    && find /var/www/html -type d -exec chmod 755 {} \; \
    && chmod 775 /var/www/html/storage \
    && find /var/www/html -type f -exec chmod 644 {} \;

EXPOSE 80

CMD ["apache2-foreground"]
