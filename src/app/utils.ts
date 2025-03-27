/**
 * Escape a string to be used inside a regex as literal.
 *
 * see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
 *
 * @param string string to escape
 * @returns escaped string
 */
function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export function getMimetypeLikeMatcher(mimetypeLike: string | null) {
    if (mimetypeLike == null || mimetypeLike === "*" || mimetypeLike === "*/*") {
        // no filter/wildcard => match everything
        return (toMatch: string) => true;
    }
    if (!mimetypeLike.includes("/")) {
        // only one part filter
        return (toMatch: string) => {
            if (toMatch === "*" || toMatch.startsWith("*/")) {
                return true;  // matching string is wildcard
            }
            if (toMatch === mimetypeLike || toMatch.startsWith(`${mimetypeLike}/`)) {
                return true;  // actual match
            }
            return false;
        }
    }

    // mimetype like contains both parts
    const splitType = mimetypeLike.split("/", 2);
    const splitStart = splitType[0];
    let splitEnd = splitType[1];
    if (splitEnd == null || splitEnd === "") {
        splitEnd = "*";
    }

    let regex = "^";
    if (splitStart == null || splitStart === "" || splitStart === "*") {
        regex += "[^/]+";
    } else {
        regex += `(${escapeRegExp(splitStart)}|\\*)`;
    }
    regex += "/";
    if (splitEnd == null || splitEnd === "" || splitEnd === "*") {
    } else {
        regex += `(${escapeRegExp(splitEnd)}|\\*)`;
    }

    const compiledRegex = new RegExp(regex);


    return (toMatch: string) => {
        if (toMatch === "*" || toMatch.startsWith("*/*")) {
            return true;  // matching string is wildcard
        }
        if (compiledRegex.test(toMatch)) {
            return true;
        }
        return false;
    }
}
