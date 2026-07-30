# Sector Group Master

sort numbers of input (10 - 30) with different Industry Sector, different Areas of Expertise into 4 equal groups

First sort by same Areas of Expertise, then same Industry Sector
then similar Industry Sector (from High to Low), then similar Areas of Expertise (from High to Low), then fill in remainders

Master data: 
8 Industry Sectors +1 Others
a mapping about similar Industry Sector with each other (High/Medium/Low)
8 Areas of Expertise +1 Others
a mapping about similar Areas of Expertise with each other (High/Medium/Low)

UI for input sample data fields: 
Nick Name (free text)
Industry Sectors (refer to Master data)
Areas of Expertise (refer to Master data)
If input Other, add one free text field with "Please specify"

Process flow:
input sample data and press "Input", first sample data saved, field clear and allow input second sample data
after all sample data input, press "FINISH" in the bottom
Run sample sorting and divide all samples into 4 groups with equal number of sample (may be +1 or -1 sample in one group)

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://groupit-smartly.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b0d8a03c-d818-454c-b0cd-e90ab8156e48).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
