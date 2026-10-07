"""
J.A.R.V.I.S. OS Web and Search Tools
Safely handles URL navigation and web searches without executing arbitrary shell scripts.
"""

import webbrowser
import urllib.parse

def open_url(url: str):
    """
    Safely opens a validated URL in the default browser.
    """
    url_clean = url.strip()
    if not (url_clean.startswith("http://") or url_clean.startswith("https://")):
        url_clean = "https://" + url_clean

    try:
        webbrowser.open(url_clean)
        return {
            "success": True,
            "url": url_clean,
            "message": f"Opening {url_clean}, sir."
        }
    except Exception as e:
        return {"success": False, "error": f"Failed to open URL: {str(e)}"}

def search_web(query: str):
    """
    Performs a web search via Google.
    """
    clean_query = query.strip()
    search_url = f"https://www.google.com/search?q={urllib.parse.quote_plus(clean_query)}"
    try:
        webbrowser.open(search_url)
        return {
            "success": True,
            "query": clean_query,
            "url": search_url,
            "message": f"Searching Google for '{clean_query}', sir."
        }
    except Exception as e:
        return {"success": False, "error": f"Failed to perform search: {str(e)}"}
