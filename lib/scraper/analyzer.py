"""
Harvard Q Guide Analyzer
Analyzes Q Guide HTML files and generates comprehensive statistics.
Exports results to both JSON and CSV formats.
"""

import json
import os
import csv
import statistics
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor, as_completed
from glob import glob
import multiprocessing

from bs4 import BeautifulSoup
from tqdm import tqdm


def process_rows(raw_rows):
    """Extract text from table rows."""
    return [x.text.strip() for x in raw_rows]


def get_stats(raw_rows):
    """Calculate statistics from rating distribution."""
    rows = process_rows(raw_rows)
    try:
        if int(rows[0]) == 0:
            # no one answered this question
            return None
    except (ValueError, IndexError):
        return None
    
    try:
        freqs = rows[1:-2]
        freqs = [int(x[:-1]) for x in freqs]
        scores = []
        freqs.reverse()
        for i in range(5):
            scores += [i + 1] * freqs[i]
        
        if not scores:
            return None
        
        mean = float(rows[-2])
        return mean
    except (ValueError, IndexError):
        return None


def get_table_with(tables, th_text):
    """Find table with specific header text."""
    for table in tables:
        try:
            if table.tr and table.tr.th and table.tr.th.text.strip() == th_text:
                return table
        except AttributeError:
            continue
    return None


def analyze_file_batch(file_batch, courses_data):
    """Analyze a batch of files - used by worker processes."""
    results = []
    
    for filepath in file_batch:
        result = analyze_single_file(filepath, courses_data)
        if result:
            results.append(result)
    
    return results


def analyze_single_file(filepath, courses_data):
    """Analyze a single Q guide HTML file."""
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            page_text = f.read()
    except Exception:
        return None
    
    # Parse HTML
    try:
        soup = BeautifulSoup(page_text, 'html.parser')
        tables = soup.find_all('tbody')
    except Exception:
        return None
    
    if len(tables) < 3:
        return None
    
    result = {}
    
    # Extract filename info
    filename = os.path.basename(filepath)
    parts = filename.replace('.html', '').split('_')
    if len(parts) < 3:
        return None
    
    fas_id = parts[0]
    semester_year = parts[1]
    professor = '_'.join(parts[2:])
    
    result['fas_id'] = fas_id
    result['semester_year'] = semester_year
    result['professor'] = professor
    
    # Get course code and title from pre-loaded data
    if fas_id in courses_data:
        # Find the course code and title for this specific semester/professor
        found = False
        for offering in courses_data[fas_id].get('offerings', []):
            if (offering.get('semester_year') == semester_year and 
                offering.get('professor') == professor.replace('_', ' ')):
                result['course_code'] = offering.get('course_code', 'UNKNOWN')
                result['course_title'] = offering.get('course_title', '')
                found = True
                break
        
        if not found:
            # Use the first course code/title if no exact match
            course_codes = courses_data[fas_id].get('course_codes', [])
            course_titles = courses_data[fas_id].get('course_titles', [])
            result['course_code'] = course_codes[0] if course_codes else 'UNKNOWN'
            result['course_title'] = course_titles[0] if course_titles else ''
    else:
        result['course_code'] = 'UNKNOWN'
        result['course_title'] = ''
    
    # Number of students (invited count)
    result['num_students'] = 0
    response_rate_table = get_table_with(tables, 'Invited')
    if response_rate_table:
        try:
            tds = response_rate_table.find_all('td')
            if tds:
                result['num_students'] = int(tds[0].text.strip())
        except (ValueError, IndexError, AttributeError):
            pass
    else:
        # Try alternative headers
        response_rate_table = get_table_with(tables, 'Responded')
        if response_rate_table:
            try:
                tds = response_rate_table.find_all('td')
                if len(tds) > 1:
                    result['num_students'] = int(tds[1].text.strip())
            except (ValueError, IndexError, AttributeError):
                pass
    
    # Course overall rating
    result['course_rating'] = 0
    course_score_table = get_table_with(tables, 'Evaluate the course overall.')
    if course_score_table:
        try:
            course_score_rows = course_score_table.tr.find_all('td')
            course_rating = get_stats(course_score_rows)
            result['course_rating'] = course_rating if course_rating else 0
        except AttributeError:
            pass
    
    # Workload (hours per week)
    result['hours_per_week'] = 0
    workload_table = get_table_with(tables, 'Hours per week')
    if not workload_table:
        workload_table = get_table_with(tables, 'Response Count')
    
    if workload_table:
        try:
            workload_rows = workload_table.find_all('td')
            if workload_rows:
                workload_text = process_rows(workload_rows)
                # Look for the mean value in the last 4 elements
                for val in workload_text[-4:]:
                    try:
                        if val and val != 'N/A':
                            result['hours_per_week'] = float(val.split(',')[0])
                            break
                    except (ValueError, AttributeError):
                        continue
        except AttributeError:
            pass
    
    return result


def get_semester_order():
    """Return the ordered list of semesters from oldest to newest."""
    semesters = []
    for year in range(2021, 2026):
        semesters.append(f"{year}Spring")
        semesters.append(f"{year}Fall")
    return semesters


def analyze_qguides_parallel():
    """Analyze Q Guide HTML files using parallel processing."""
    # Find all HTML files in QGuides directory
    html_files = glob('data/QGuides/**/*.html', recursive=True)
    
    if not html_files:
        print("ERROR: No HTML files found in data/QGuides directory")
        print("Please run the downloader first to populate data/QGuides/")
        return None
    
    print(f"Found {len(html_files)} Q guide files to analyze")
    
    # Load courses data once
    print("Loading course mapping data...")
    courses_file = 'output/courses_by_fas_id.json'
    if not os.path.exists(courses_file):
        print(f"ERROR: {courses_file} not found. Please run scraper.py first.")
        return None
    
    with open(courses_file, 'r') as f:
        courses_data = json.load(f)
    
    # Determine number of workers
    num_workers = min(multiprocessing.cpu_count(), 8)
    print(f"Using {num_workers} parallel workers")
    
    # Split files into batches for parallel processing
    batch_size = max(1, len(html_files) // (num_workers * 4))
    file_batches = [html_files[i:i + batch_size] for i in range(0, len(html_files), batch_size)]
    
    # Process files in parallel
    all_results = []
    
    with ProcessPoolExecutor(max_workers=num_workers) as executor:
        # Submit all batch jobs
        future_to_batch = {
            executor.submit(analyze_file_batch, batch, courses_data): batch 
            for batch in file_batches
        }
        
        # Process completed batches with progress bar
        with tqdm(total=len(html_files), desc="Analyzing files") as pbar:
            for future in as_completed(future_to_batch):
                try:
                    batch_results = future.result()
                    all_results.extend(batch_results)
                    pbar.update(len(future_to_batch[future]))
                except Exception as e:
                    print(f"Error processing batch: {e}")
                    pbar.update(len(future_to_batch[future]))
    
    print(f"Successfully analyzed {len(all_results)} files")
    return all_results


def export_to_csv(results):
    """Export analysis results to CSV format."""
    if not results:
        print("No results to export")
        return
    
    os.makedirs('output', exist_ok=True)
    csv_file = 'output/qguide_data.csv'
    
    # Prepare CSV data
    with open(csv_file, 'w', newline='', encoding='utf-8') as f:
        fieldnames = [
            'fas_id', 'course_code', 'course_title', 'department',
            'professor', 'semester', 'course_rating', 'hours_per_week',
            'num_students', 'rating_category', 'workload_category', 'size_category'
        ]
        
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        for result in results:
            # Extract department from course code
            code = result.get('course_code', 'UNKNOWN')
            dept = code.split()[0] if ' ' in code else code
            
            rating = result.get('course_rating', 0)
            hours = result.get('hours_per_week', 0)
            students = result.get('num_students', 0)
            
            # Categorize rating
            if rating >= 4.5:
                rating_cat = 'Excellent'
            elif rating >= 4.0:
                rating_cat = 'Good'
            elif rating >= 3.5:
                rating_cat = 'Satisfactory'
            elif rating > 0:
                rating_cat = 'Below Average'
            else:
                rating_cat = 'No Data'
            
            # Categorize workload
            if hours < 4:
                workload_cat = 'Light'
            elif hours <= 8:
                workload_cat = 'Moderate'
            elif hours > 0:
                workload_cat = 'Heavy'
            else:
                workload_cat = 'No Data'
            
            # Categorize size
            if students < 15:
                size_cat = 'Small'
            elif students <= 50:
                size_cat = 'Medium'
            elif students > 0:
                size_cat = 'Large'
            else:
                size_cat = 'No Data'
            
            writer.writerow({
                'fas_id': result['fas_id'],
                'course_code': code,
                'course_title': result.get('course_title', ''),
                'department': dept,
                'professor': result.get('professor', '').replace('_', ' '),
                'semester': result.get('semester_year', ''),
                'course_rating': rating,
                'hours_per_week': hours,
                'num_students': students,
                'rating_category': rating_cat,
                'workload_category': workload_cat,
                'size_category': size_cat
            })
    
    print(f"✓ Exported CSV to {csv_file}")
    return csv_file


def main():
    """Main function to run the analysis."""
    print("="*60)
    print("Harvard Q Guide Analyzer")
    print("="*60)
    
    # Check if required files exist
    if not os.path.exists('output/courses_by_fas_id.json'):
        print("\nERROR: courses_by_fas_id.json not found.")
        print("Please run scraper.py first to generate the course mapping.")
        return
    
    if not os.path.exists('data/QGuides'):
        print("\nERROR: data/QGuides directory not found.")
        print("Please create data/QGuides and add Q Guide HTML files.")
        return
    
    # Run parallel analysis
    print("\nStarting Q guide analysis with parallel processing...")
    results = analyze_qguides_parallel()
    
    if not results:
        print("No data was successfully analyzed")
        return
    
    # Export to CSV
    print("\nExporting data to CSV...")
    csv_file = export_to_csv(results)
    
    # Print summary statistics
    print(f"\n{'='*60}")
    print("Analysis Complete!")
    print(f"{'='*60}")
    print(f"Total sections analyzed: {len(results)}")
    print(f"CSV data saved to: {csv_file}")
    
    # Show some statistics
    ratings = [r['course_rating'] for r in results if r.get('course_rating', 0) > 0]
    if ratings:
        print(f"\nRating Statistics:")
        print(f"  Average: {statistics.mean(ratings):.2f}/5.00")
        print(f"  Median: {statistics.median(ratings):.2f}/5.00")
        print(f"  Highest: {max(ratings):.2f}/5.00")
        print(f"  Lowest: {min(ratings):.2f}/5.00")


if __name__ == "__main__":
    main()

