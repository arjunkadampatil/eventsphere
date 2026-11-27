// Small seeded random helpers for demo data, so seeding is reproducible and needs no
// heavy faker dependency in the production install.

const FIRST_NAMES = [
  'Aditi', 'Aditya', 'Akash', 'Ananya', 'Anika', 'Arjun', 'Aryan', 'Bhavya', 'Dev', 'Diya', 'Esha', 'Gaurav',
  'Ishaan', 'Isha', 'Kabir', 'Kavya', 'Krish', 'Meera', 'Mihir', 'Naina', 'Neha', 'Nikhil', 'Pooja', 'Pranav',
  'Priya', 'Rahul', 'Rhea', 'Riya', 'Rohan', 'Saanvi', 'Sahil', 'Sanya', 'Shreya', 'Siddharth', 'Simran', 'Tanvi',
  'Tara', 'Uday', 'Vanya', 'Varun', 'Vihaan', 'Yash', 'Zoya', 'Harsh', 'Jhanvi', 'Lakshya', 'Mansi', 'Om',
];
const LAST_NAMES = [
  'Agarwal', 'Bansal', 'Bhatt', 'Chauhan', 'Das', 'Desai', 'Gupta', 'Iyer', 'Jain', 'Joshi', 'Kapoor', 'Khan',
  'Kulkarni', 'Kumar', 'Mehta', 'Menon', 'Mishra', 'Nair', 'Pandey', 'Patel', 'Pillai', 'Rao', 'Reddy', 'Saxena',
  'Sharma', 'Singh', 'Srivastava', 'Thakur', 'Tiwari', 'Verma', 'Yadav',
];

function createRandom(seed = 7) {
  let state = seed >>> 0;
  const next = () => {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min, max) => min + Math.floor(next() * (max - min + 1));
  const float = (min = 0, max = 1) => min + next() * (max - min);
  const pick = (list) => list[Math.floor(next() * list.length)];
  const sample = (list, count) => {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, count);
  };
  const dateBetween = (from, to) => new Date(from.getTime() + next() * Math.max(0, to.getTime() - from.getTime()));
  const person = () => ({ first: pick(FIRST_NAMES), last: pick(LAST_NAMES) });
  return { next, int, float, pick, sample, dateBetween, person };
}

module.exports = { createRandom };
