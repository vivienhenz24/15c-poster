# downloads q guides and put them in the folder QGuides

import concurrent.futures
import json
import os
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import time
from threading import Lock

PACKAGES = []


def preprocess_qlinks():
    # Load the JSON file with courses grouped by FAS ID
    with open('courses_by_fas_id.json', 'r') as f:
        courses_data = json.load(f)
    
    # Extract all unique links with their identifiers
    for fas_id, course_info in courses_data.items():
        for offering in course_info['offerings']:
            # Create a unique filename for each offering
            # Format: FAS_ID_SEMESTER_YEAR_PROFESSOR
            professor_clean = offering['professor'].replace(' ', '_').replace('/', '_')
            filename = f"{fas_id}_{offering['semester_year']}_{professor_clean}"
            
            # Add to packages list
            PACKAGES.append([offering['link'], filename, fas_id])
    
    print(f"Found {len(PACKAGES)} total Q guide links to download")


preprocess_qlinks()
# Uncomment line below to test code with smaller sample
# PACKAGES = PACKAGES[:10]

# Thread-safe counter
counter_lock = Lock()
global_count = 0
last_print_time = 0

# Create the QGuide folder if not exist
if not os.path.exists('QGuides'):
    os.makedirs('QGuides')

# Pre-create all subdirectories to avoid filesystem contention
unique_fas_ids = set(package[2] for package in PACKAGES)
for fas_id in unique_fas_ids:
    os.makedirs(f'QGuides/{fas_id}', exist_ok=True)

# Choose any QGuide link, visit it on your browser, then open DevTools (Applications pane)
# to copy everything in the cookie field
# There should be three cookies: ASP.NET_SessionId, CookieName, and session_token
# Copy paste the entire cookie string into secret_cookie.txt as one line.
# You should create the secret cookie file
# the file should looke like
# "ASP.NET_SessionId=value; CookieName=value2; session_token=value3"
with open('secret_cookie.txt', 'r') as f:
    cookie = f.read().strip()


def create_session():
    """Create a requests session with connection pooling and retry logic."""
    session = requests.Session()
    
    # Configure retry strategy
    retry_strategy = Retry(
        total=3,
        backoff_factor=0.3,
        status_forcelist=[429, 500, 502, 503, 504],
    )
    
    # Configure connection pooling
    adapter = HTTPAdapter(
        max_retries=retry_strategy,
        pool_connections=50,  # Number of connection pools
        pool_maxsize=50,      # Max connections per pool
    )
    
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    
    # Set default headers
    session.headers.update({
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
    })
    
    return session


# Thread-local storage for sessions
from threading import local
thread_local = local()

def get_session():
    """Get or create a session for the current thread."""
    if not hasattr(thread_local, "session"):
        thread_local.session = create_session()
    return thread_local.session


# Retrieve a single page and report the URL and contents
def load_url(package):
    global global_count, last_print_time
    url = package[0]
    filename = package[1]
    fas_id = package[2]
    
    # Check if file already exists (skip if already downloaded)
    filepath = f'QGuides/{fas_id}/{filename}.html'
    if os.path.exists(filepath):
        with counter_lock:
            global_count += 1
            current_time = time.time()
            # Print progress every 0.5 seconds to reduce console spam
            if current_time - last_print_time > 0.5:
                print(f"Progress: {global_count/len(PACKAGES)*100:.2f}% ({global_count}/{len(PACKAGES)}) - Skipped existing: {filename}")
                last_print_time = current_time
        return True
    
    try:
        session = get_session()
        
        # Shorter timeout since we have retries
        response = session.get(url, timeout=30)
        response.raise_for_status()
        
        # Write file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(response.text)
        
        with counter_lock:
            global_count += 1
            current_time = time.time()
            # Print progress every 0.5 seconds to reduce console spam
            if current_time - last_print_time > 0.5:
                print(f"Progress: {global_count/len(PACKAGES)*100:.2f}% ({global_count}/{len(PACKAGES)}) - Downloaded: {filename}")
                last_print_time = current_time
        
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"Error downloading {filename}: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error with {filename}: {e}")
        return False


# Track failed downloads
failed_downloads = []

print(f"\nStarting parallel download with optimized settings...")
print(f"Using 25 concurrent workers with connection pooling\n")

start_time = time.time()

# Use more workers for faster downloads
with concurrent.futures.ThreadPoolExecutor(max_workers=25) as executor:
    # Submit all tasks
    future_to_package = {executor.submit(load_url, package): package for package in PACKAGES}
    
    # Process completed futures
    for future in concurrent.futures.as_completed(future_to_package):
        package = future_to_package[future]
        try:
            success = future.result()
            if not success:
                failed_downloads.append(package)
        except Exception as exc:
            print(f'{package[1]} generated an exception: {exc}')
            failed_downloads.append(package)

end_time = time.time()
elapsed_time = end_time - start_time

print("\n" + "="*50)
print("Download complete!")
print(f"Time elapsed: {elapsed_time:.2f} seconds")
print(f"Average speed: {len(PACKAGES)/elapsed_time:.2f} files/second")
print(f"Successfully processed: {global_count}/{len(PACKAGES)} files")

if failed_downloads:
    print(f"\nFailed downloads: {len(failed_downloads)}")
    print("Failed files (first 10):")
    for package in failed_downloads[:10]:
        print(f"  - {package[1]}")
    
    # Save failed downloads to a file for retry
    with open('failed_downloads.json', 'w') as f:
        json.dump(failed_downloads, f, indent=2)
    print("\nFailed downloads saved to failed_downloads.json for retry")
else:
    print("\nAll files downloaded successfully!")