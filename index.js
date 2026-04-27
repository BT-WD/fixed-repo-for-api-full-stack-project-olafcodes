const CAT_API_URL = 'https://api.thecatapi.com/v1/images/search';

async function fetchCat() {
  const res = await fetch(CAT_API_URL);
  const data = await res.json();
  console.log(data);
}

document.addEventListener('DOMContentLoaded', fetchCat);