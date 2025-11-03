import json
import os
import re
from bs4 import BeautifulSoup
from glob import glob

os.chdir(os.path.dirname(os.path.abspath(__file__)))

def extract_fas_id(element_id):
    """Extract the FAS ID from the element id attribute."""
    if element_id and element_id.startswith('FAS-'):
        match = re.match(r'FAS-(\d+)-', element_id)
        if match:
            return match.group(1)
    return None

def parse_html_file(filepath):
    """Parse a single HTML file and extract course information."""
    with open(filepath, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')
    
    # Extract semester/year from filename
    filename = os.path.basename(filepath)
    semester_year = filename.replace('QReports_', '').replace('.htm', '').replace('.html', '')
    
    courses = []
    
    for link in soup.find_all('a'):
        if 'bluera' not in link.get('href', ''):
            continue
        
        element_id = link.get('id', '')
        fas_id = extract_fas_id(element_id)
        
        if not fas_id:
            continue
        
        text = link.get_text().strip()
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        if not lines:
            continue
        
        # Parse course code and title from first line
        first_line = lines[0]
        segments = first_line.split(' ')
        
        # Extract course code (e.g., "COMPSCI 61")
        if len(segments) >= 2:
            course_code = segments[0] + ' ' + segments[1].split('-')[0]
            # Get the rest as course title
            title_start = len(segments[0]) + 1 + len(segments[1].split('-')[0])
            course_title = first_line[title_start:].strip()
            if course_title.startswith('-'):
                course_title = course_title[1:].strip()
        else:
            course_code = first_line
            course_title = ""
        
        # Extract professor name (usually in parentheses on second line)
        professor = ""
        if len(lines) > 1:
            professor_line = lines[1]
            if professor_line.startswith('(') and professor_line.endswith(')'):
                professor = professor_line[1:-1]
        
        courses.append({
            'fas_id': fas_id,
            'course_code': course_code,
            'course_title': course_title,
            'professor': professor,
            'link': link.get('href'),
            'element_id': element_id,
            'semester_year': semester_year
        })
    
    return courses

def merge_courses_by_fas_id(all_courses):
    """Merge courses by FAS ID, grouping links by semester/year."""
    merged = {}
    
    for course in all_courses:
        fas_id = course['fas_id']
        
        if fas_id not in merged:
            merged[fas_id] = {
                'fas_id': fas_id,
                'course_codes': set(),
                'course_titles': set(),
                'professors': set(),
                'offerings': []
            }
        
        # Add to sets to track all variations
        if course['course_code']:
            merged[fas_id]['course_codes'].add(course['course_code'])
        if course['course_title']:
            merged[fas_id]['course_titles'].add(course['course_title'])
        if course['professor']:
            merged[fas_id]['professors'].add(course['professor'])
        
        # Add offering details
        merged[fas_id]['offerings'].append({
            'semester_year': course['semester_year'],
            'course_code': course['course_code'],
            'course_title': course['course_title'],
            'professor': course['professor'],
            'link': course['link'],
            'element_id': course['element_id']
        })
    
    # Convert sets to lists for JSON serialization
    for fas_id in merged:
        merged[fas_id]['course_codes'] = list(merged[fas_id]['course_codes'])
        merged[fas_id]['course_titles'] = list(merged[fas_id]['course_titles'])
        merged[fas_id]['professors'] = list(merged[fas_id]['professors'])
        # Sort offerings by semester/year for consistency
        merged[fas_id]['offerings'].sort(key=lambda x: x['semester_year'])
    
    return merged

def main():
    # Find all HTML files in old_html directory
    html_files = glob('old_html/QReports_*.htm*')
    
    if not html_files:
        # Try current directory for single file
        html_files = glob('QReports.htm*')
    
    all_courses = []
    
    print(f"Processing {len(html_files)} HTML files...")
    
    for filepath in html_files:
        print(f"Processing {filepath}...")
        courses = parse_html_file(filepath)
        all_courses.extend(courses)
        print(f"  Found {len(courses)} courses")
    
    # Merge courses by FAS ID
    merged_courses = merge_courses_by_fas_id(all_courses)
    
    # Save to JSON
    output_file = 'courses_by_fas_id.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(merged_courses, f, indent=2, ensure_ascii=False)
    
    # Print statistics
    print(f"\nTotal unique FAS IDs: {len(merged_courses)}")
    print(f"Total course offerings: {len(all_courses)}")
    
    # Show some examples
    print("\nExample entries:")
    for i, (fas_id, data) in enumerate(list(merged_courses.items())[:3]):
        print(f"\nFAS ID: {fas_id}")
        print(f"  Course codes: {', '.join(data['course_codes'])}")
        print(f"  Semesters: {', '.join(set(o['semester_year'] for o in data['offerings']))}")
        print(f"  Number of offerings: {len(data['offerings'])}")
    
    print(f"\nData saved to {output_file}")

if __name__ == "__main__":
    main()