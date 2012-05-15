#!/bin/bash
kicker -c -e 's3cmd -vfrP --exclude="*swp" --exclude=".git*" sync . s3://static.lmorchard.com/art-maker/'
