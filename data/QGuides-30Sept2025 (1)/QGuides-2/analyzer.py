import json
import os
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
    
    # Number of students (invited count) - optimized parsing
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
    
    # Course overall rating - optimized parsing
    result['course_rating'] = 0
    course_score_table = get_table_with(tables, 'Evaluate the course overall.')
    if course_score_table:
        try:
            course_score_rows = course_score_table.tr.find_all('td')
            course_rating = get_stats(course_score_rows)
            result['course_rating'] = course_rating if course_rating else 0
        except AttributeError:
            pass
    
    # Workload (hours per week) - optimized parsing
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


def get_latest_semester(available_semesters):
    """Get the latest semester from a list of available semesters."""
    semester_order = get_semester_order()
    
    # Find the latest semester that exists in available_semesters
    for semester in reversed(semester_order):
        if semester in available_semesters:
            return semester
    
    # If no match found in our ordered list, return the last one alphabetically
    if available_semesters:
        return sorted(available_semesters)[-1]
    return None


def aggregate_by_course_and_semester_parallel():
    """Aggregate data by FAS ID and semester using parallel processing."""
    # Find all HTML files in QGuides directory
    html_files = glob('QGuides/**/*.html', recursive=True)
    
    if not html_files:
        print("No HTML files found in QGuides directory")
        return {}
    
    print(f"Found {len(html_files)} Q guide files to analyze")
    
    # Load courses data once
    print("Loading course mapping data...")
    with open('courses_by_fas_id.json', 'r') as f:
        courses_data = json.load(f)
    
    # Determine number of workers (use CPU count but cap at 8 for stability)
    num_workers = min(multiprocessing.cpu_count(), 8)
    print(f"Using {num_workers} parallel workers")
    
    # Split files into batches for parallel processing
    batch_size = max(1, len(html_files) // (num_workers * 4))  # Create more batches than workers
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
    
    # Aggregate by FAS ID and semester
    aggregated = defaultdict(lambda: defaultdict(list))
    
    for result in all_results:
        fas_id = result['fas_id']
        semester = result['semester_year']
        
        aggregated[fas_id][semester].append({
            'professor': result['professor'],
            'course_code': result['course_code'],
            'course_title': result['course_title'],
            'course_rating': result['course_rating'],
            'hours_per_week': result['hours_per_week'],
            'num_students': result['num_students']
        })
    
    # Calculate averages for each FAS ID/semester
    final_data = {}
    
    for fas_id, semesters in aggregated.items():
        final_data[fas_id] = {
            'semesters': {}
        }
        
        # Track all course codes and titles used across all semesters
        all_course_codes = set()
        all_course_titles = set()
        
        # Process each semester
        for semester, offerings in semesters.items():
            # Filter out zero values for averaging
            ratings = [o['course_rating'] for o in offerings if o['course_rating'] > 0]
            hours = [o['hours_per_week'] for o in offerings if o['hours_per_week'] > 0]
            students = [o['num_students'] for o in offerings if o['num_students'] > 0]
            
            # Get course codes and titles for this semester
            semester_course_codes = list(set(o['course_code'] for o in offerings if o['course_code']))
            semester_course_titles = list(set(o['course_title'] for o in offerings if o['course_title']))
            
            # Add to overall tracking
            all_course_codes.update(semester_course_codes)
            all_course_titles.update(semester_course_titles)
            
            semester_data = {
                'course_code': semester_course_codes[0] if semester_course_codes else 'UNKNOWN',
                'course_codes': semester_course_codes,  # All codes used this semester
                'course_title': semester_course_titles[0] if semester_course_titles else '',
                'course_titles': semester_course_titles,  # All titles used this semester
                'avg_course_rating': round(statistics.mean(ratings), 2) if ratings else 0,
                'avg_hours_per_week': round(statistics.mean(hours), 2) if hours else 0,
                'avg_num_students': round(statistics.mean(students), 0) if students else 0,
                'num_sections': len(offerings),
                'professors': list(set(o['professor'] for o in offerings)),
                'individual_sections': offerings  # Keep individual data if needed
            }
            
            final_data[fas_id]['semesters'][semester] = semester_data
        
        # Add all course codes/titles at the top level
        final_data[fas_id]['all_course_codes'] = sorted(list(all_course_codes))
        final_data[fas_id]['all_course_titles'] = sorted(list(all_course_titles))
        
        # Add latest statistics at the top level
        latest_semester = get_latest_semester(list(semesters.keys()))
        if latest_semester and latest_semester in final_data[fas_id]['semesters']:
            latest_data = final_data[fas_id]['semesters'][latest_semester]
            final_data[fas_id]['latest_semester'] = latest_semester
            final_data[fas_id]['latest_course_code'] = latest_data['course_code']
            final_data[fas_id]['latest_course_title'] = latest_data['course_title']
            final_data[fas_id]['latest_course_rating'] = latest_data['avg_course_rating']
            final_data[fas_id]['latest_hours_per_week'] = latest_data['avg_hours_per_week']
            final_data[fas_id]['latest_num_students'] = latest_data['avg_num_students']
        else:
            # Fallback if no data found
            final_data[fas_id]['latest_semester'] = 'N/A'
            final_data[fas_id]['latest_course_code'] = 'UNKNOWN'
            final_data[fas_id]['latest_course_title'] = ''
            final_data[fas_id]['latest_course_rating'] = 0
            final_data[fas_id]['latest_hours_per_week'] = 0
            final_data[fas_id]['latest_num_students'] = 0
    
    # Sort the data for better readability
    sorted_data = {}
    for fas_id in sorted(final_data.keys()):
        sorted_data[fas_id] = final_data[fas_id]
        # Sort semesters within each course
        sorted_semesters = {}
        semester_order = get_semester_order()
        
        # First add semesters in our defined order
        for semester in semester_order:
            if semester in final_data[fas_id]['semesters']:
                sorted_semesters[semester] = final_data[fas_id]['semesters'][semester]
        
        # Then add any remaining semesters not in our order (edge cases)
        for semester in sorted(final_data[fas_id]['semesters'].keys()):
            if semester not in sorted_semesters:
                sorted_semesters[semester] = final_data[fas_id]['semesters'][semester]
        
        sorted_data[fas_id]['semesters'] = sorted_semesters
    
    return sorted_data


def main():
    """Main function to run the analysis."""
    print("Starting Q guide analysis with parallel processing...")
    
    # Check if required files exist
    if not os.path.exists('courses_by_fas_id.json'):
        print("ERROR: courses_by_fas_id.json not found. Please run scraper.py first.")
        return
    
    if not os.path.exists('QGuides'):
        print("ERROR: QGuides directory not found. Please run downloader.py first.")
        return
    
    # Run parallel analysis
    aggregated_data = aggregate_by_course_and_semester_parallel()
    
    if not aggregated_data:
        print("No data was successfully analyzed")
        return
    
    # Save to JSON
    output_file = 'results/course_analytics.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(aggregated_data, f, indent=2, ensure_ascii=False)
    
    # Print summary statistics
    print(f"\nAnalysis complete!")
    print(f"Total courses (FAS IDs) analyzed: {len(aggregated_data)}")
    
    total_sections = sum(
        sum(sem_data['num_sections'] for sem_data in course_data['semesters'].values())
        for course_data in aggregated_data.values()
    )
    print(f"Total sections analyzed: {total_sections}")
    
    # Show top-rated courses based on latest data
    top_courses = []
    for fas_id, course_data in aggregated_data.items():
        if course_data['latest_course_rating'] > 0:
            top_courses.append((
                f"{course_data['latest_course_code']} (FAS-{fas_id}, {course_data['latest_semester']})",
                course_data['latest_course_rating'],
                course_data['latest_num_students']
            ))
    
    if top_courses:
        top_courses.sort(key=lambda x: x[1], reverse=True)
        
        print("\nTop 5 highest-rated courses (based on latest semester):")
        for course, rating, students in top_courses[:5]:
            print(f"  {course}: {rating:.2f}/5.0 ({int(students)} students)")
    
    print(f"\nData saved to {output_file}")


if __name__ == "__main__":
    main()