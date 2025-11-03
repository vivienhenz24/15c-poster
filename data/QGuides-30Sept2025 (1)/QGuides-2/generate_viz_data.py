"""
Generate visualization-ready data from Q Guide analytics.

This script creates CSV and JSON files optimized for visualization in D3.js,
suitable for a CS171 final project.
"""

import json
import csv
from collections import defaultdict
import os

def load_data():
    """Load the course analytics JSON file."""
    with open('results/course_analytics.json', 'r') as f:
        return json.load(f)


def generate_course_summary_csv(data):
    """Generate a CSV with one row per course (latest semester data)."""
    output_file = 'results/courses_summary.csv'
    
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = [
            'fas_id', 'course_code', 'course_title', 'department',
            'rating', 'hours_per_week', 'num_students', 'semester',
            'num_semesters_offered', 'rating_category', 'workload_category', 'size_category'
        ]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        
        for fas_id, course_data in data.items():
            # Extract department from course code
            code = course_data.get('latest_course_code', 'UNKNOWN')
            dept = code.split()[0] if ' ' in code else code
            
            rating = course_data.get('latest_course_rating', 0)
            hours = course_data.get('latest_hours_per_week', 0)
            students = int(course_data.get('latest_num_students', 0))
            
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
                'fas_id': fas_id,
                'course_code': code,
                'course_title': course_data.get('latest_course_title', ''),
                'department': dept,
                'rating': rating,
                'hours_per_week': hours,
                'num_students': students,
                'semester': course_data.get('latest_semester', ''),
                'num_semesters_offered': len(course_data.get('semesters', {})),
                'rating_category': rating_cat,
                'workload_category': workload_cat,
                'size_category': size_cat
            })
    
    print(f"✓ Generated {output_file}")


def generate_time_series_csv(data):
    """Generate a CSV with time series data for all courses."""
    output_file = 'results/courses_timeseries.csv'
    
    semester_order = ['2022Fall', '2023Spring', '2023Fall', '2024Spring', '2024Fall', '2025Spring']
    
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = [
            'fas_id', 'course_code', 'department', 'semester',
            'rating', 'hours_per_week', 'num_students', 'num_sections'
        ]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        
        for fas_id, course_data in data.items():
            code = course_data.get('latest_course_code', 'UNKNOWN')
            dept = code.split()[0] if ' ' in code else code
            
            for semester in semester_order:
                if semester in course_data.get('semesters', {}):
                    sem_data = course_data['semesters'][semester]
                    
                    writer.writerow({
                        'fas_id': fas_id,
                        'course_code': sem_data.get('course_code', code),
                        'department': dept,
                        'semester': semester,
                        'rating': sem_data.get('avg_course_rating', 0),
                        'hours_per_week': sem_data.get('avg_hours_per_week', 0),
                        'num_students': int(sem_data.get('avg_num_students', 0)),
                        'num_sections': sem_data.get('num_sections', 0)
                    })
    
    print(f"✓ Generated {output_file}")


def generate_department_summary(data):
    """Generate department-level aggregated statistics."""
    dept_stats = defaultdict(lambda: {
        'courses': [],
        'ratings': [],
        'workloads': [],
        'enrollments': []
    })
    
    for fas_id, course_data in data.items():
        code = course_data.get('latest_course_code', 'UNKNOWN')
        dept = code.split()[0] if ' ' in code else code
        
        rating = course_data.get('latest_course_rating', 0)
        hours = course_data.get('latest_hours_per_week', 0)
        students = course_data.get('latest_num_students', 0)
        
        dept_stats[dept]['courses'].append(code)
        if rating > 0:
            dept_stats[dept]['ratings'].append(rating)
        if hours > 0:
            dept_stats[dept]['workloads'].append(hours)
        if students > 0:
            dept_stats[dept]['enrollments'].append(students)
    
    # Calculate aggregates
    output_data = []
    for dept, stats in dept_stats.items():
        if len(stats['courses']) >= 3:  # Minimum 3 courses
            output_data.append({
                'department': dept,
                'num_courses': len(stats['courses']),
                'avg_rating': round(sum(stats['ratings']) / len(stats['ratings']), 2) if stats['ratings'] else 0,
                'avg_hours': round(sum(stats['workloads']) / len(stats['workloads']), 2) if stats['workloads'] else 0,
                'avg_enrollment': round(sum(stats['enrollments']) / len(stats['enrollments']), 0) if stats['enrollments'] else 0,
                'total_enrollment': int(sum(stats['enrollments']))
            })
    
    # Sort by average rating
    output_data.sort(key=lambda x: x['avg_rating'], reverse=True)
    
    # Save as CSV
    csv_file = 'results/departments_summary.csv'
    with open(csv_file, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['department', 'num_courses', 'avg_rating', 'avg_hours', 'avg_enrollment', 'total_enrollment']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(output_data)
    
    print(f"✓ Generated {csv_file}")
    
    # Save as JSON for D3.js
    json_file = 'results/departments_summary.json'
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"✓ Generated {json_file}")


def generate_scatter_plot_data(data):
    """Generate data for workload vs. rating scatter plot."""
    scatter_data = []
    
    for fas_id, course_data in data.items():
        rating = course_data.get('latest_course_rating', 0)
        hours = course_data.get('latest_hours_per_week', 0)
        students = course_data.get('latest_num_students', 0)
        code = course_data.get('latest_course_code', 'UNKNOWN')
        dept = code.split()[0] if ' ' in code else code
        
        if rating > 0 and hours > 0:
            scatter_data.append({
                'fas_id': fas_id,
                'course_code': code,
                'department': dept,
                'rating': rating,
                'hours_per_week': hours,
                'num_students': int(students),
                'course_title': course_data.get('latest_course_title', '')[:60]  # Truncate long titles
            })
    
    output_file = 'results/workload_vs_rating.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(scatter_data, f, indent=2)
    
    print(f"✓ Generated {output_file}")


def generate_top_courses_json(data):
    """Generate JSON of top-rated courses for visualization."""
    top_courses = []
    
    for fas_id, course_data in data.items():
        rating = course_data.get('latest_course_rating', 0)
        students = course_data.get('latest_num_students', 0)
        
        # Only include courses with at least 10 students
        if rating > 0 and students >= 10:
            top_courses.append({
                'fas_id': fas_id,
                'course_code': course_data.get('latest_course_code', ''),
                'course_title': course_data.get('latest_course_title', ''),
                'rating': rating,
                'hours_per_week': course_data.get('latest_hours_per_week', 0),
                'num_students': int(students),
                'semester': course_data.get('latest_semester', '')
            })
    
    # Sort by rating
    top_courses.sort(key=lambda x: x['rating'], reverse=True)
    
    # Save top 50
    output_file = 'results/top_50_courses.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(top_courses[:50], f, indent=2)
    
    print(f"✓ Generated {output_file}")


def generate_semester_trends(data):
    """Generate semester-by-semester trend data."""
    semester_order = ['2022Fall', '2023Spring', '2023Fall', '2024Spring', '2024Fall', '2025Spring']
    
    trends = []
    for semester in semester_order:
        ratings = []
        workloads = []
        enrollments = []
        
        for course_data in data.values():
            if semester in course_data.get('semesters', {}):
                sem_data = course_data['semesters'][semester]
                
                if sem_data.get('avg_course_rating', 0) > 0:
                    ratings.append(sem_data['avg_course_rating'])
                if sem_data.get('avg_hours_per_week', 0) > 0:
                    workloads.append(sem_data['avg_hours_per_week'])
                if sem_data.get('avg_num_students', 0) > 0:
                    enrollments.append(sem_data['avg_num_students'])
        
        trends.append({
            'semester': semester,
            'year': int(semester[:4]),
            'term': semester[4:],
            'avg_rating': round(sum(ratings) / len(ratings), 2) if ratings else 0,
            'avg_hours': round(sum(workloads) / len(workloads), 2) if workloads else 0,
            'avg_enrollment': round(sum(enrollments) / len(enrollments), 0) if enrollments else 0,
            'num_courses': len(ratings)
        })
    
    output_file = 'results/semester_trends.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(trends, f, indent=2)
    
    print(f"✓ Generated {output_file}")


def main():
    """Main function to generate all visualization data files."""
    print("Loading course analytics data...")
    data = load_data()
    print(f"Loaded {len(data)} courses\n")
    
    print("Generating visualization data files:")
    print("-" * 50)
    
    generate_course_summary_csv(data)
    generate_time_series_csv(data)
    generate_department_summary(data)
    generate_scatter_plot_data(data)
    generate_top_courses_json(data)
    generate_semester_trends(data)
    
    print("-" * 50)
    print("\n✓ All visualization data files generated successfully!")
    print("\nGenerated files in results/:")
    print("  - courses_summary.csv        : One row per course (latest semester)")
    print("  - courses_timeseries.csv     : Time series for all courses")
    print("  - departments_summary.csv    : Department-level statistics (CSV)")
    print("  - departments_summary.json   : Department-level statistics (JSON)")
    print("  - workload_vs_rating.json    : Scatter plot data")
    print("  - top_50_courses.json        : Top 50 rated courses")
    print("  - semester_trends.json       : Semester-by-semester trends")
    print("\nThese files are ready for D3.js visualization!")


if __name__ == "__main__":
    main()


