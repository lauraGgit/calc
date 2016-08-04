# CALC and the US Web Design Standards
CALC predates standards.usa.gov by quite a bit. We wanted to bring CALC up to
date, while retaining its original design (and avoiding a complete rewrite).
We first thought we'd just install WDS via npm, but WDS requires the installation 
of Bourbon & co., while CALC is built on Skeleton. In the end, we decided to
simply copy relevant code snippets from the WDS.

### Organization
In this uswds folder, you'll find the code we stole from the Standards. Each file
retains the original name of the WDS file it came from. These files are imported
into Sass files in `components` or `base`. You should only need to import files
from `components` and `base` into `main.scss`.

### Making changes
If a change is minor (bumping the font size up or down, say), it's been made in
the `uswds` file with a comment stating the change. If it's major (adding new
rules to change behavior or significant styling), it's made in the `components`
or `base` file after the `uswds` import rule.

Notice all `usa` prefixes have been removed. This is is necessary in some places
to override Skeleton's defaults, so for consistency it has been removed everywhere.
