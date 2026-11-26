"""Offline examples of the listing and deadline structures used by the providers."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from opportunity_sources import SOURCES, fetch_source, scholarship_deadline


SOURCES_BY_ID = {source["id"]: source for source in SOURCES}


def rows_from(source_id, index, details=None):
    source = SOURCES_BY_ID[source_id]
    pages = {source["url"]: index, **(details or {})}
    return fetch_source(source, pages.__getitem__)


class ProgrammeSources(unittest.TestCase):
    def test_southampton_uses_the_card_heading_and_excludes_undergraduate_courses(self):
        rows = rows_from("southampton", '''
          <h3>Electronic Engineering</h3>
          <a href="/courses/electronic-engineering-degree-beng">Find out more</a>
          <h3>Microelectronics Systems Design</h3>
          <a href="/courses/microelectronics-systems-design-masters-msc">Find out more</a>
          <a href="/courses/unrelated-masters-msc">Find out more</a>
        ''')
        self.assertEqual([r["title"] for r in rows], ["Microelectronics Systems Design"])
        self.assertEqual(rows[0]["kind"], "program")

    def test_hku_links_keep_the_programme_identifier_and_combine_duplicates(self):
        admissions = "https://portal.hku.hk/tpg-admissions/programme-details?mode=0&amp;programme=ices"
        rows = rows_from("hku-ece", f'''
          <a href="{admissions}">MSc(Eng) in <b>Integrated Circuits</b> and Electronic Systems (ICES)</a>
          <a href="{admissions}&amp;utm_source=nav">MSc(Eng) in Integrated Circuits and Electronic Systems (ICES)</a>
          <a href="https://external.example/msc">MSc(Eng) in Embedded Systems</a>
          <a href="https://portal.hku.hk/tpg-admissions/programme-details?mode=0&amp;programme=lat">MSc(Eng) in Low-Altitude Technology</a>
        ''')
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["field"], "IC design")
        self.assertIn("programme=ices", rows[0]["url"])
        self.assertNotIn("deadline", rows[0])
        rows = rows_from("hku-mech", '''
          <a href="/mest/">Microelectronics Science and Technology (MEST)</a>
          <a href="/mest/">Microelectronics Science &amp; Technology</a>
          <a href="/research/">Microelectronics Research</a>
        ''')
        self.assertEqual([r["url"] for r in rows], ["https://mech.hku.hk/mest/"])

    def test_hku_central_index_recognizes_full_time_courses_and_stable_portal_links(self):
        link = "/tola/html/dr/frontpage/instruction.htm?Faculty_of_Engineering%3BMaster_of_Science_in_Engineering_in_Integrated_Circuits_and_Electronic_Systems%5BMSc(Eng)(ICES)%5D_%3BR413%3B%3BF="
        engineering = "/tola/html/dr/frontpage/instruction.htm?Faculty_of_Engineering%3BMaster_of_Science_in_Engineering_in_Embedded_Systems%5BMSc(Eng)(ES)%5D_%3BR500%3B%3BF="
        rows = rows_from("hku-ece", f'<a href="{link}">Full-time</a><a href="{link}">Part-time</a><a href="{engineering}">Full-time</a>')
        self.assertEqual(len(rows), 2)
        self.assertIn("portal.hku.hk", rows[0]["url"])
        self.assertIn("(ICES)", rows[0]["title"])
        self.assertIn("sweb.hku.hk", rows[1]["url"])
        self.assertEqual(rows[1]["field"], "Embedded systems")

    def test_kth_filters_offtopic_navigation_and_untrusted_urls(self):
        rows = rows_from("kth-programmes", '''
          <a href="/en/studies/master/embedded-systems">Embedded Systems</a>
          <a href="/en/studies/master/programmes">Browse all programmes in Electrical Engineering</a>
          <a href="/en/studies/master/architecture">Architecture</a>
          <a href="https://www.kth.se.external.example/en/studies/master/microelectronics">Microelectronics</a>
          <a href="https://alice@www.kth.se/en/studies/master/microelectronics">Microelectronics</a>
        ''')
        self.assertEqual([r["title"] for r in rows], ["Embedded Systems"])
        self.assertEqual(rows[0]["country"], "Sweden")


class ScholarshipSources(unittest.TestCase):
    def test_kth_uses_the_award_closing_date_only(self):
        base = "https://www.kth.se/en/studies/master/admissions/scholarships/"
        award = base + "kth-india-scholarship-1.422144"
        details = {award: '''<p>1 December 2026: Application opens<br>
                             <strong>15 January 2027</strong>: Application closes<br>
                             1 April 2027: Scholarship results announced</p>'''}
        index = f'''<a href="{award}">KTH India Scholarship</a>
                    <a href="{base}scholarship-faq">Scholarship FAQs</a>'''
        rows = rows_from("kth-scholarships", index, details)
        self.assertEqual([(r["kind"], r["deadline"]) for r in rows], [("scholarship", "2027-01-15")])
        self.assertIsNone(scholarship_deadline("kth-scholarships", "15 January: Application closes"))

    def test_csc_uses_the_application_deadline_with_explicit_year(self):
        base = "https://cscuk.fcdo.gov.uk/scholarships/"
        shared = base + "commonwealth-shared-scholarships-applications/"
        masters = base + "commonwealth-masters-scholarships/"
        rows = rows_from("commonwealth", f'''
            <h2><a href="{shared}">Commonwealth Shared Scholarships</a></h2>
            <h2><a href="{masters}">Commonwealth Master’s Scholarships</a></h2>
            <h2><a href="{base}phd/">Commonwealth PhD Scholarships</a></h2>
        ''', {
            shared: '<p>The closing date for applications is 16:00 GMT on Tuesday <b>8 December 2026</b>.</p>',
            masters: '<p>The closing date for applications was 16:00 BST on Tuesday 20 October.</p>',
        })
        self.assertEqual(rows[0]["deadline"], "2026-12-08")
        self.assertNotIn("deadline", rows[1])
        self.assertEqual(len(rows), 2)
        self.assertIsNone(scholarship_deadline("commonwealth", "The closing date for applications is 31 February 2027."))

    def test_fetch_does_not_follow_unregistered_source(self):
        with self.assertRaises(ValueError):
            fetch_source({"id": "commonwealth", "url": "https://example.com/"}, lambda _: self.fail("unexpected fetch"))


if __name__ == "__main__":
    unittest.main()
