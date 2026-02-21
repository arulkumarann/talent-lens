import requests
import json
import time
import random
import re
import base64
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
from openai import OpenAI
from PIL import Image
import io

@dataclass
class DesignerPortfolio:
    name: str
    username: str
    profile_image: str
    followers_count: str
    followings_count: str
    likes_count: str
    location: str
    is_pro: bool
    specializations: List[str]
    price: str
    last_responds: str
    description: str
    works: List[Dict[str, str]]
    scraped_at: str
    social_links: List[str]

class KeywordGenerator:
    def __init__(self, openai_api_key: str):
        self.openai_api_key = openai_api_key
    
    def generate_search_keywords(self, original_queries: List[str]) -> List[str]:
        try:
            focus_area = ", ".join(original_queries)
            
            openai_url = "https://api.openai.com/v1/chat/completions"
            
            headers = {
                "Authorization": f"Bearer {self.openai_api_key}",
                "Content-Type": "application/json"
            }
            
            system_prompt = """You are a design recruitment expert specializing in finding the best designers on Dribbble. Your task is to generate highly specific and effective search keywords that will help find the most relevant designers for a given focus area.

Rules:
1. Generate exactly 5 search keywords/phrases
2. Keywords should be specific to the design domain mentioned
3. Focus on terms that designers actually use in their profiles and specializations
4. Include both broad categories and specific niches within the domain
5. Consider current design trends and industry terminology
6. Return only a JSON array of 5 strings
7. Keywords should be 1-3 words each, optimized for Dribbble search

Example for "web design":
["ui design", "web development", "responsive design", "user interface", "frontend design"]"""

            user_prompt = f"""Generate 5 specific search keywords for finding designers in this focus area: "{focus_area}"

The keywords should help find the most relevant and skilled designers on Dribbble for this particular domain. Focus on terms that would appear in designer profiles, specializations, and project descriptions.

Return only a JSON array of exactly 5 strings."""
            
            data = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "max_tokens": 200,
                "temperature": 0.3
            }
            
            response = requests.post(openai_url, headers=headers, json=data, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                gpt_response = result['choices'][0]['message']['content']
                
                try:
                    keywords = json.loads(gpt_response)
                    if isinstance(keywords, list) and len(keywords) == 5:
                        print(f"Generated keywords: {keywords}")
                        return keywords
                    else:
                        print(f"Invalid keyword format, falling back to original queries")
                        return original_queries
                        
                except json.JSONDecodeError:
                    try:
                        if "```json" in gpt_response:
                            json_start = gpt_response.find("```json") + 7
                            json_end = gpt_response.find("```", json_start)
                            json_content = gpt_response[json_start:json_end].strip()
                        elif "```" in gpt_response:
                            json_start = gpt_response.find("```") + 3
                            json_end = gpt_response.find("```", json_start)
                            json_content = gpt_response[json_start:json_end].strip()
                        else:
                            json_match = re.search(r'\[.*?\]', gpt_response, re.DOTALL)
                            if json_match:
                                json_content = json_match.group()
                            else:
                                json_content = gpt_response.strip()
                        
                        keywords = json.loads(json_content)
                        if isinstance(keywords, list) and len(keywords) == 5:
                            print(f"Generated keywords: {keywords}")
                            return keywords
                        else:
                            print(f"Invalid keyword format, falling back to original queries")
                            return original_queries
                            
                    except (json.JSONDecodeError, ValueError) as e:
                        print(f"Could not parse GPT response for keywords: {str(e)}")
                        return original_queries
                        
            else:
                print(f"OpenAI API failed for keyword generation: {response.status_code}")
                return original_queries
                
        except Exception as e:
            print(f"Error during keyword generation: {str(e)}")
            return original_queries

class SocialLinksExtractor:
    def __init__(self):
        self.jina_api_key = ""
        self.openai_api_key = ""
    
    def scrape_profile(self, url: str) -> Optional[str]:
        jina_url = "https://r.jina.ai/"
        
        headers = {
            "Authorization": f"Bearer {self.jina_api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Engine": "browser",
            "X-With-Shadow-Dom": "true"
        }
        
        data = {"url": url}
        
        try:
            response = requests.post(jina_url, headers=headers, json=data)
            
            if response.status_code == 200:
                json_data = response.json()
                raw_content = json_data.get('data', {}).get('content', '')
                return raw_content
            else:
                return None
                
        except Exception as e:
            return None
    
    def extract_links_with_gpt(self, raw_content: str) -> Optional[List[str]]:
        openai_url = "https://api.openai.com/v1/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {self.openai_api_key}",
            "Content-Type": "application/json"
        }
        
        system_prompt = """You are a social media link extractor. Your task is to analyze the provided raw content from a profile page and extract ONLY the social media links that belong to the person/profile owner.

Rules:
1. Extract only social media platform links (Twitter, Instagram, LinkedIn, Facebook, TikTok, YouTube, etc.)
2. Only include links that clearly belong to the profile owner, not external references or mentions
3. Return the links as a clean JSON array of strings
4. If no social media links are found, return an empty array
5. Remove any duplicates
6. Ensure links are complete and properly formatted

Example output format:
["https://twitter.com/username", "https://instagram.com/username", "https://linkedin.com/in/username"]"""

        user_prompt = f"Extract the social media links from this profile content:\n\n{raw_content}"
        
        data = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "max_tokens": 1000,
            "temperature": 0.1
        }
        
        try:
            response = requests.post(openai_url, headers=headers, json=data)
            
            if response.status_code == 200:
                result = response.json()
                gpt_response = result['choices'][0]['message']['content']
                
                try:
                    links = json.loads(gpt_response)
                    return links if isinstance(links, list) else []
                except json.JSONDecodeError:
                    try:
                        if "```json" in gpt_response:
                            json_start = gpt_response.find("```json") + 7
                            json_end = gpt_response.find("```", json_start)
                            json_content = gpt_response[json_start:json_end].strip()
                        elif "```" in gpt_response:
                            json_start = gpt_response.find("```") + 3
                            json_end = gpt_response.find("```", json_start)
                            json_content = gpt_response[json_start:json_end].strip()
                        else:
                            json_content = gpt_response.strip()
                        
                        links = json.loads(json_content)
                        return links if isinstance(links, list) else []
                        
                    except (json.JSONDecodeError, ValueError) as e:
                        return []
                    
            else:
                return []
                
        except Exception as e:
            return []
    
    def extract_social_links(self, username: str) -> List[str]:
        profile_url = f"https://dribbble.com/{username}/about"
        
        raw_content = self.scrape_profile(profile_url)
        
        if not raw_content:
            return []
        
        social_links = self.extract_links_with_gpt(raw_content)
        
        if social_links:
            return social_links
        else:
            return []

class DribbbleScraper:
    def __init__(self, rapidapi_key: str, openai_api_key: str):
        self.rapidapi_key = rapidapi_key
        self.headers = {
            'x-rapidapi-host': 'dribbble-scraper.p.rapidapi.com',
            'x-rapidapi-key': rapidapi_key
        }
        self.social_extractor = SocialLinksExtractor()
    
    def search_designers(self, query: str) -> List[Dict]:
        try:
            print(f"Searching Dribbble for: {query}")
            
            search_url = f'https://dribbble-scraper.p.rapidapi.com/api/v1/designers/search?query={query}'
            response = requests.get(search_url, headers=self.headers, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                designers = data.get('data', {}).get('designers', [])
                print(f"Found {len(designers)} designers from Dribbble API")
                return designers
            else:
                return []
                
        except requests.exceptions.Timeout:
            return []
        except Exception as e:
            return []
    
    def get_designer_details(self, username: str) -> Dict:
        try:
            detail_url = f'https://dribbble-scraper.p.rapidapi.com/api/v1/designers/detail?username={username}'
            response = requests.get(detail_url, headers=self.headers, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                return data.get('data', {}).get('designer', {})
            else:
                return {}
                
        except Exception as e:
            return {}
    
    def get_designer_shots(self, username: str) -> List[Dict]:
        try:
            shots_url = f'https://dribbble-scraper.p.rapidapi.com/api/v1/designers/shots?username={username}'
            response = requests.get(shots_url, headers=self.headers, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                shots = data.get('data', {}).get('designer', {}).get('shots', [])
                return shots
            else:
                return []
                
        except Exception as e:
            return []
    
    def convert_dribbble_to_portfolio(self, search_info: Dict, details: Dict, shots: List[Dict], social_links: List[str]) -> DesignerPortfolio:
        works = []
        for shot in shots:
            work = {
                "id": shot.get('id', ''),
                "title": shot.get('title', 'Untitled Shot'),
                "image_url": shot.get('image_url', ''),
                "slug": shot.get('slug', ''),
                "teaser_videos": shot.get('teaser_videos', {})
            }
            works.append(work)
        
        specializations = search_info.get('specializations', [])
        if not specializations:
            specializations = []
        
        portfolio = DesignerPortfolio(
            name=search_info.get('name', details.get('name', '')),
            username=search_info.get('username', details.get('username', '')),
            profile_image=search_info.get('profile_image', details.get('profile_image', '')),
            followers_count=details.get('followers_count', '0'),
            followings_count=details.get('followings_count', '0'),
            likes_count=details.get('likes_count', '0'),
            location=search_info.get('location', ''),
            is_pro=search_info.get('is_pro', False),
            specializations=specializations,
            price=search_info.get('price', 'N/A'),
            last_responds=search_info.get('last_responds', 'N/A'),
            description=details.get('description', 'N/A'),
            works=works,
            scraped_at=time.strftime('%Y-%m-%d %H:%M:%S'),
            social_links=social_links
        )
        
        return portfolio
    
    def run_scraper(self, search_queries: List[str], max_profiles_per_keyword: int = 5) -> List[DesignerPortfolio]:
        all_portfolios = []
        processed_usernames = set()
        
        try:
            for query in search_queries:
                print(f"\nSearching with keyword: '{query}'")
                
                designers = self.search_designers(query)
                
                if not designers:
                    print(f"No designers found for '{query}'")
                    continue
                
                profiles_with_social_links = 0
                designer_index = 0
                
                while profiles_with_social_links < max_profiles_per_keyword and designer_index < len(designers):
                    designer = designers[designer_index]
                    username = designer.get('username')
                    designer_index += 1
                    
                    if not username or username in processed_usernames:
                        continue
                    
                    processed_usernames.add(username)
                    
                    print(f"Processing designer: {username}")
                    
                    social_links = self.social_extractor.extract_social_links(username)
                    time.sleep(3)
                    
                    if not social_links:
                        print(f"No social links found for {username}, skipping")
                        continue
                    
                    print(f"Found {len(social_links)} social links for {username}")
                    
                    time.sleep(3)
                    details = self.get_designer_details(username)
                    
                    time.sleep(3)
                    shots = self.get_designer_shots(username)
                    
                    print(f"Got {len(shots)} shots for {username}")
                    
                    try:
                        portfolio = self.convert_dribbble_to_portfolio(designer, details, shots, social_links)
                        all_portfolios.append(portfolio)
                        profiles_with_social_links += 1
                        print(f"Added profile {profiles_with_social_links}/{max_profiles_per_keyword} for keyword '{query}'")
                    except Exception as e:
                        print(f"Error converting profile for {username}: {e}")
                        continue
                    
                    time.sleep(4)
                
                print(f"Completed keyword '{query}': {profiles_with_social_links} profiles with social links")
                time.sleep(2)
            
            print(f"\nTotal profiles collected: {len(all_portfolios)}")
            return all_portfolios
            
        except Exception as e:
            print(f"Error in run_scraper: {e}")
            return []

class PortfolioAnalyzer:
    def __init__(self, api_key, focus_area, max_relevant_works=5, max_images_per_work=3):
        self.client = OpenAI(api_key=api_key)
        self.focus_area = focus_area
        self.max_relevant_works = max_relevant_works
        self.max_images_per_work = max_images_per_work
    
    def download_image_to_memory(self, url: str) -> Optional[str]:
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://dribbble.com/',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
            }
            
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()
            
            content_type = response.headers.get('content-type', '')
            if not content_type.startswith('image/'):
                return None
            
            if len(response.content) < 5000:
                return None
            
            base64_image = base64.b64encode(response.content).decode('utf-8')
            return base64_image
            
        except Exception as e:
            return None
    
    def process_work_images(self, work: Dict, profile_username: str, work_index: int) -> List[Dict]:
        image_url = work.get('image_url', '')
        
        if not image_url:
            return []
        
        downloaded_images = []
        base64_image = self.download_image_to_memory(image_url)
        
        if base64_image:
            clean_title = re.sub(r'[^a-zA-Z0-9_-]', '_', work.get('title', 'untitled').lower())[:30]
            img_filename = f"{profile_username}_{clean_title}_{work_index}.jpg"
            
            downloaded_images.append({
                "filename": img_filename,
                "base64_data": base64_image,
                "original_url": image_url
            })
        
        return downloaded_images
    
    def analyze_image_with_gpt(self, base64_image: str, work_title: str, specializations: List[str]) -> Optional[str]:
        try:
            specializations_text = ", ".join(specializations) if specializations else "general design"
            
            response = self.client.chat.completions.create(
                model="gpt-4.1",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"Critically evaluate this {self.focus_area} design project titled '{work_title}' by a designer specializing in: {specializations_text}. Provide a comprehensive analysis covering: Visual Design Excellence, User Experience and Interaction Design, Industry Contextual Relevance, Technical Realism and Frontend Architecture, Innovation and Strategic Creativity, and how well it aligns with their stated specializations. Use precise observations and refer to specific visual cues or UI components."
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=600
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            return None
    
    def analyze_with_o4_mini(self, profile_data: Dict, relevant_works: List[Dict], image_analyses: List[Dict]) -> Dict:
        try:
            portfolio_summary = {
                "designer_name": profile_data['name'],
                "username": profile_data['username'],
                "dribbble_metrics": {
                    "followers_count": profile_data['followers_count'],
                    "followings_count": profile_data['followings_count'],
                    "likes_count": profile_data['likes_count'],
                    "is_pro": profile_data['is_pro'],
                    "price": profile_data['price'],
                    "last_responds": profile_data['last_responds']
                },
                "specializations": profile_data['specializations'],
                "location": profile_data['location'],
                "description": profile_data['description'],
                "relevant_works_count": len(relevant_works),
                "total_images_analyzed": sum(len(work['images']) for work in relevant_works),
                "works_summary": [
                    {
                        "title": work['title'],
                        "id": work.get('id', ''),
                        "images_count": work['image_count']
                    } for work in relevant_works
                ],
                "detailed_image_analyses": image_analyses
            }
            
            specializations_text = ", ".join(profile_data['specializations']) if profile_data['specializations'] else "general design"
            
            user_prompt = f"""Evaluate this {self.focus_area} designer's Dribbble portfolio and provide your evaluation in this exact JSON format:

{{
  "overall_rating": <float between 1.0-5.0>,
  "overall_score": <integer between 20-100>,
  "metrics": {{
    "design_excellence": {{
      "rating": <float between 1.0-5.0>,
      "reasoning": "Detailed explanation"
    }},
    "ux_mastery": {{
      "rating": <float between 1.0-5.0>,
      "reasoning": "Detailed explanation"
    }},
    "industry_expertise": {{
      "rating": <float between 1.0-5.0>,
      "reasoning": "Detailed explanation focusing on {self.focus_area}"
    }},
    "technical_sophistication": {{
      "rating": <float between 1.0-5.0>,
      "reasoning": "Detailed explanation"
    }},
    "innovation_creativity": {{
      "rating": <float between 1.0-5.0>,
      "reasoning": "Detailed explanation"
    }},
    "specialization_alignment": {{
      "rating": <float between 1.0-5.0>,
      "reasoning": "How well work aligns with stated specializations: {specializations_text}"
    }},
    "market_positioning": {{
      "rating": <float between 1.0-5.0>,
      "reasoning": "Assessment based on pricing ({profile_data['price']}) and response time ({profile_data['last_responds']})"
    }}
  }},
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "areas_for_improvement": ["improvement 1", "improvement 2", "improvement 3"],
  "portfolio_highlights": ["highlight 1", "highlight 2"],
  "recommendation": {{
    "decision": "HIRE/CONSIDER/REJECT",
    "confidence": "HIGH/MEDIUM/LOW",
    "reasoning": "Explanation",
    "suitable_roles": ["Role 1", "Role 2"],
    "salary_range": "Junior/Mid/Senior level",
    "value_for_money": "Assessment based on price point"
  }},
  "detailed_feedback": {{
    "what_stands_out": "What makes this designer unique",
    "biggest_concerns": "Main concerns",
    "growth_potential": "Assessment of potential",
    "industry_fit": "How well suited for {self.focus_area}",
    "dribbble_presence": "Assessment of Dribbble presence and engagement",
    "specialization_depth": "How deep their expertise is in stated specializations"
  }}
}}

PORTFOLIO DATA:
{json.dumps(portfolio_summary, indent=2)}"""

            response = self.client.chat.completions.create(
                model="o4-mini",
                messages=[
                    {
                        "role": "user",
                        "content": user_prompt
                    }
                ]
            )
            
            analysis_text = response.choices[0].message.content
            json_match = re.search(r'\{.*\}', analysis_text, re.DOTALL)
            
            if json_match:
                analysis = json.loads(json_match.group())
                if 'overall_score' not in analysis:
                    analysis['overall_score'] = round((analysis.get('overall_rating', 2.5) / 5.0) * 100)
                return analysis
            else:
                raise ValueError("No valid JSON found in response")
                
        except Exception as e:
            return {
                "overall_rating": 2.5,
                "overall_score": 50,
                "metrics": {
                    "design_excellence": {"rating": 2.5, "reasoning": "Analysis failed"},
                    "ux_mastery": {"rating": 2.5, "reasoning": "Analysis failed"},
                    "industry_expertise": {"rating": 2.5, "reasoning": "Analysis failed"},
                    "technical_sophistication": {"rating": 2.5, "reasoning": "Analysis failed"},
                    "innovation_creativity": {"rating": 2.5, "reasoning": "Analysis failed"},
                    "specialization_alignment": {"rating": 2.5, "reasoning": "Analysis failed"},
                    "market_positioning": {"rating": 2.5, "reasoning": "Analysis failed"}
                },
                "strengths": ["Manual review required"],
                "areas_for_improvement": ["System error occurred"],
                "portfolio_highlights": ["Analysis failed"],
                "recommendation": {
                    "decision": "MANUAL_REVIEW",
                    "confidence": "LOW",
                    "reasoning": f"Analysis failed: {str(e)}",
                    "suitable_roles": ["Unknown"],
                    "salary_range": "Unknown",
                    "value_for_money": "Unknown"
                },
                "detailed_feedback": {
                    "what_stands_out": "Analysis failed",
                    "biggest_concerns": "System error",
                    "growth_potential": "Unknown",
                    "industry_fit": "Unknown",
                    "dribbble_presence": "Unknown",
                    "specialization_depth": "Unknown"
                }
            }
    
    def process_profile(self, profile_data: Dict) -> Optional[Dict]:
        try:
            username = profile_data['username']
            print(f"Analyzing: {username}")
            
            relevant_works = []
            works_to_process = profile_data['works'][:self.max_relevant_works]
            
            print(f"Processing first {len(works_to_process)} works")
            
            for work_index, work in enumerate(works_to_process):
                downloaded_images = self.process_work_images(work, username, work_index)
                
                if downloaded_images:
                    work_data = {
                        "id": work.get('id', ''),
                        "title": work['title'],
                        "slug": work.get('slug', ''),
                        "images": downloaded_images,
                        "image_count": len(downloaded_images)
                    }
                    relevant_works.append(work_data)
                
                time.sleep(2)
            
            if not relevant_works:
                print(f"No works with images found for {username}")
                return None
            
            print(f"Processing {len(relevant_works)} works with images")
            
            image_analyses = []
            for work in relevant_works:
                work_analysis = {
                    "work_id": work['id'],
                    "work_title": work['title'],
                    "work_slug": work['slug'],
                    "image_analyses": []
                }
                
                for image in work['images']:
                    analysis = self.analyze_image_with_gpt(
                        image['base64_data'], 
                        work['title'], 
                        profile_data['specializations']
                    )
                    if analysis:
                        work_analysis['image_analyses'].append({
                            "filename": image['filename'],
                            "analysis": analysis
                        })
                        time.sleep(3)
                
                image_analyses.append(work_analysis)
            
            print("Generating final analysis with o4-mini")
            final_analysis = self.analyze_with_o4_mini(profile_data, relevant_works, image_analyses)
            
            clean_relevant_works = []
            for work in relevant_works:
                clean_work = {
                    "id": work['id'],
                    "title": work['title'],
                    "slug": work['slug'],
                    "image_count": work['image_count'],
                    "images": [{"filename": img['filename'], "original_url": img['original_url']} for img in work['images']]
                }
                clean_relevant_works.append(clean_work)
            
            final_profile = {
                "original_data": profile_data,
                "relevant_works": clean_relevant_works,
                "image_analyses": image_analyses,
                "final_analysis": final_analysis,
                "social_media_links": profile_data['social_links'],
                "processed_at": datetime.now().isoformat(),
                "total_relevant_works": len(relevant_works),
                "total_images_extracted": sum(len(work['images']) for work in relevant_works),
                "processing_metadata": {
                    "images_analyzed": len([img for work in image_analyses for img in work['image_analyses']]),
                    "analysis_model": "o4-mini",
                    "vision_model": "gpt-4.1",
                    "max_relevant_works_limit": self.max_relevant_works,
                    "max_images_per_work_limit": self.max_images_per_work,
                    "focus_area": self.focus_area,
                    "platform": "dribbble",
                    "social_links_extracted": len(profile_data['social_links'])
                },
                "dribbble_specific": {
                    "is_pro": profile_data['is_pro'],
                    "price": profile_data['price'],
                    "last_responds": profile_data['last_responds'],
                    "specializations": profile_data['specializations']
                }
            }
            
            return final_profile
            
        except Exception as e:
            print(f"Error processing profile: {e}")
            return None
    
    def process_all_profiles(self, portfolios: List[DesignerPortfolio]) -> List[Dict]:
        print(f"Found {len(portfolios)} profiles to analyze")
        
        processed_profiles = []
        
        for portfolio in portfolios:
            profile_data = asdict(portfolio)
            
            result = self.process_profile(profile_data)
            if result:
                processed_profiles.append(result)
            
            time.sleep(5)
        
        return processed_profiles

def run_dribbble_portfolio_scraper(
    search_queries: List[str] = ["web design"],
    max_profiles: int = 5,
    max_relevant_works: int = 5,
    max_images_per_work: int = 3,
    openai_api_key: str = None,
    rapidapi_key: str = "
    "
):
    if not openai_api_key:
        raise ValueError("OpenAI API key is required")
    
    if not rapidapi_key:
        raise ValueError("RapidAPI key is required")
    
    try:
        print(f"Original search queries: {search_queries}")
        
        keyword_generator = KeywordGenerator(openai_api_key)
        ai_generated_keywords = keyword_generator.generate_search_keywords(search_queries)
        
        print(f"AI Generated Keywords: {ai_generated_keywords}")
        print(f"Will use these {len(ai_generated_keywords)} keywords for searching")
        
        final_search_queries = ai_generated_keywords
        focus_area = ", ".join(search_queries)
        
        print(f"Focus area: {focus_area}")
        print(f"Search queries: {final_search_queries}")
        print(f"Limits: {max_profiles} profiles per keyword, {max_relevant_works} works/designer, {max_images_per_work} images/work")
        
        scraper = DribbbleScraper(rapidapi_key, openai_api_key)
        
        portfolios = scraper.run_scraper(
            search_queries=final_search_queries,
            max_profiles_per_keyword=max_profiles
        )
        
        if not portfolios:
            print("No portfolios found")
            return []
        
        print(f"Starting analysis of {len(portfolios)} portfolios")
        
        analyzer = PortfolioAnalyzer(
            api_key=openai_api_key,
            focus_area=focus_area,
            max_relevant_works=max_relevant_works,
            max_images_per_work=max_images_per_work
        )
        
        processed_profiles = analyzer.process_all_profiles(portfolios)
        
        print(f"Analysis complete. {len(processed_profiles)} profiles processed")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"dribbble_analysis_results_{timestamp}.json"
        
        results_metadata = {
            "generation_metadata": {
                "original_queries": search_queries,
                "ai_generated_keywords": ai_generated_keywords,
                "focus_area": focus_area,
                "total_profiles_found": len(portfolios),
                "total_profiles_analyzed": len(processed_profiles),
                "generated_at": datetime.now().isoformat(),
                "keyword_generation_model": "gpt-4o-mini"
            },
            "processed_profiles": processed_profiles
        }
        # with open(filename, "w", encoding='utf-8') as f:
        #     json.dump(results_metadata, f, indent=2, ensure_ascii=False)
        # print(f"Final results saved to {filename}")
        
        return processed_profiles
        
    except Exception as e:
        print(f"Error: {e}")
        return []

if __name__ == "__main__":
    custom_search_queries = ["VC Fund Dashboard", "Cap Table"]
    

    
    results = run_dribbble_portfolio_scraper(
        search_queries=custom_search_queries,
        max_profiles=1,
        max_relevant_works=1,
        max_images_per_work=1,
        openai_api_key=OPENAI_API_KEY,
        rapidapi_key=RAPIDAPI_KEY
    )
    print(results)

    print(f"\nfnal results: {len(results)} profiles")

    print("\n completed")