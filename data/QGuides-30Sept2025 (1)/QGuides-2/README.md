### Scraping the QGuide

1. First the program needs to discover all the QGuide links for that year and term. Navigate to this link `https://qreports.fas.harvard.edu/browse/index?school=FAS&calTerm=YEAR%20SEMESTER` where you replace `YEAR` with the current year (e.g. `2025`) and `SEMESTER` with one of `Spring` and `Fall`. It requires login.
2. Download the webpage (<kbd>ctrl</kbd>+<kbd>s</kbd> or <kbd>cmd</kbd>+<kbd>s</kbd>) as a HTML-only file. Add it to `old_html`
4. Update `courses_by_fas_id.json` with new HTML files. If creating the json for the first time, run `scraper.py`
5. 3. To-do: create an update script that will download selectively. Otherwise just use `downloader.py` (see section below to get downloader to work)
6. Run `analyzer.py`


Note

Open the Developer Console, go to Application and click on the Cookie tab. Get the values for `ASP.NET_SessionId` and `CookieName` and paste it to `secret_cookie.txt` in the following format
   ```text
   ASP.NET_SessionId=YOUR_VALUE_HERE
   CookieName=YOUR_VALUE_HERE
   ```
1. Make sure you delete the current `QGuides` folder to start afresh if it exists.
2. Run `downloader.py` to use your cookies to download all the QGuides with the links scrapped from the previous step. The QGuides will be stored at the folder `QGuides`. This takes about 5 minutes.
3.  Run `analyzer.py` to generate `course_ratings.csv`. If you run into a course with bugs, you can copy that FAS string and paste it to the `demo or debug` section of the code. My usual debugging process is to search for that file in the IDE, reveal in Finder, open in Chrome and see what's up.
4.  Once that's done, rename `course_ratings.csv` as `YEAR_TERM.csv` like `2025_Fall.csv` and put this in `release/qguide`.