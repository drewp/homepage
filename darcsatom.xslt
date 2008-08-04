<?xml version="1.0" encoding="UTF-8"?>
<!-- Convert the XML version of "darcs changes" into Atom.
     Adam Sampson <ats@offog.org>

  This is based on the "rss.xslt" stylesheet that ships with Darcs.

  Modified by drewp@bigasterisk.com to put the short repo name in each entry.

  -->

<xsl:stylesheet
	version="1.0"
	exclude-result-prefixes="str"
	xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:str="http://exslt.org/strings"
        xmlns:ast="http://bigasterisk.com/v1/darcsAtom"
	xmlns="http://www.w3.org/2005/Atom">

<xsl:param name="repoURL" />
<xsl:param name="repoName" />
<xsl:param name="feedURL" />

<xsl:template match="/changelog">
<feed>
	<title type="text"><xsl:value-of select="$repoName" /> changes</title>
	<link rel="alternate" href="{$repoURL}" />
	<link rel="self" href="{$feedURL}" />
	<id><xsl:value-of select="$repoURL" /></id>
	<generator>darcsatom</generator>
	<updated>
		<xsl:for-each select="patch[1]/@date">
		<xsl:call-template name="convertDate" />
		</xsl:for-each>
	</updated>

	<xsl:apply-templates select="patch" />
</feed>
</xsl:template>

<xsl:template match="patch">
<xsl:variable name="patchURL"><xsl:value-of select="concat($repoURL, '_darcs/patches/', @hash)" /></xsl:variable>
<entry>
	<id><xsl:value-of select="$patchURL" /></id>
	<published>
		<xsl:for-each select="@date">
		<xsl:call-template name="convertDate" />
		</xsl:for-each>
	</published>
	<updated>
		<xsl:for-each select="@date">
		<xsl:call-template name="convertDate" />
		</xsl:for-each>
	</updated>
	<title type="text"><xsl:value-of select="name" /></title>
	<author>
		<xsl:variable name="author-parts" select="str:tokenize(@author, '&lt;&gt;')" />
		<name><xsl:value-of select="normalize-space($author-parts[1])" /></name>
		<xsl:if test="$author-parts[2]">
			<email><xsl:value-of select="normalize-space($author-parts[2])" /></email>
		</xsl:if>
	</author>
	<link rel="alternate" href="{$patchURL}" />
	<summary type="text">
		<xsl:value-of select="name" />
		<xsl:if test="comment">
			<xsl:value-of select="' '" />
			<xsl:value-of select="comment" />
		</xsl:if>
	</summary>
	<ast:repoName><xsl:value-of select="$repoName"/></ast:repoName>
	<ast:patchHash><xsl:value-of select="@hash"/></ast:patchHash>
</entry>
</xsl:template>

<xsl:template name="convertDate">
	<xsl:value-of select="substring(., 1, 4)" />
	<xsl:value-of select="'-'" />
	<xsl:value-of select="substring(., 5, 2)" />
	<xsl:value-of select="'-'" />
	<xsl:value-of select="substring(., 7, 2)" />
	<xsl:value-of select="'T'" />
	<xsl:value-of select="substring(., 9, 2)" />
	<xsl:value-of select="':'" />
	<xsl:value-of select="substring(., 11, 2)" />
	<xsl:value-of select="':'" />
	<xsl:value-of select="substring(., 13, 2)" />
	<xsl:value-of select="'Z'" />
</xsl:template>

</xsl:stylesheet>
