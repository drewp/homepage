load_clara:
	curl "http://clara.io/api/scenes/d41ff9f1-f2f0-4ff4-8ce0-3983a592b43c/export/dae" -u $(shell cat user_pass.secret) > /tmp/clara.zip
	(cd clara_export; rm -f *; unzip -o /tmp/clara.zip)
