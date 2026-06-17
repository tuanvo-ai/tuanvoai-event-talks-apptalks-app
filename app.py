import os
import re
import json
import xml.etree.ElementTree as ET
import requests
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

CACHE_FILE = "release_notes_cache.json"
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def parse_release_notes_xml(xml_content):
    root = ET.fromstring(xml_content)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = []
    for entry_node in root.findall('atom:entry', ns):
        title_node = entry_node.find('atom:title', ns)
        updated_node = entry_node.find('atom:updated', ns)
        link_node = entry_node.find('atom:link', ns)
        content_node = entry_node.find('atom:content', ns)
        
        title = title_node.text if title_node is not None else ""
        updated = updated_node.text if updated_node is not None else ""
        
        link = ""
        if link_node is not None:
            link = link_node.attrib.get('href', '')
            
        content_html = content_node.text if content_node is not None else ""
        
        # Parse individual updates from HTML content
        # Split by <h3>...</h3> tags
        # Structure is: <h3>Feature</h3>\n<p>...</p>\n<h3>Issue</h3>\n<p>...</p>
        parts = re.split(r'<h3>(.*?)</h3>', content_html)
        updates = []
        
        if len(parts) > 1:
            # The first element is content before the first h3 (usually empty)
            for i in range(1, len(parts), 2):
                change_type = parts[i].strip()
                change_desc = parts[i+1].strip() if i+1 < len(parts) else ""
                updates.append({
                    "type": change_type,
                    "description": change_desc
                })
        else:
            # Fallback if no <h3> headers found
            updates.append({
                "type": "General",
                "description": content_html
            })
            
        entries.append({
            "title": title,
            "updated": updated,
            "link": link,
            "updates": updates
        })
        
    return entries

def get_release_notes(force_refresh=False):
    # Check if cache exists
    if not force_refresh and os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error reading cache: {e}")
            
    # Fetch from web
    try:
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
        
        # Parse XML
        entries = parse_release_notes_xml(response.content)
        
        # Write cache
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(entries, f, ensure_ascii=False, indent=2)
            
        return entries
    except Exception as e:
        # If fetch fails but cache exists, fall back to cache
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
        raise e

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/release-notes')
def api_release_notes():
    refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        data = get_release_notes(force_refresh=refresh)
        return jsonify({
            "status": "success",
            "data": data,
            "cached": not refresh and os.path.exists(CACHE_FILE)
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    # Run the application
    app.run(debug=True, host='0.0.0.0', port=5000)
