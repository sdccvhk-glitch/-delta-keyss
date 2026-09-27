FROM php:8.3-apache-bookworm

# The PHP Apache image should run with exactly one MPM.
# Force the prefork MPM used by mod_php and disable alternatives.
RUN docker-php-ext-install pdo_mysql \
    && a2dismod mpm_event mpm_worker 2>/dev/null || true

RUN a2enmod mpm_prefork rewrite headers expires

WORKDIR /var/www/html
COPY . /var/www/html/

RUN chown -R www-data:www-data /var/www/html \
    && find /var/www/html -type d -exec chmod 755 {} \; \
    && find /var/www/html -type f -exec chmod 644 {} \;

EXPOSE 80

CMD ["apache2-foreground"]
