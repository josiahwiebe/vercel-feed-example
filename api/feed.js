import RSS from 'rss'
import { NowRequest, NowResponse } from '@vercel/node'
import connectToDb from '../util/db'
import RSS from 'rss'
import fetch from '../util/fetch'

const getActiveLessons = async () => {
  const db = await connectToDb(process.env.MONGODB_URL)
  const lessons = await db.collection('lessons')

  const lessonResult = await lessons.find({
    active: true,
    publishedAt: {
      $lte: new Date(),
    },
  })

  const activeLessons = await lessonResult.toArray()

  return activeLessons
}

export default async (req, res) => {
  try {
    const lessons = await getActiveLessons()
    const feed = new RSS({
      title: 'Diamond Certification Lessons',
      // eslint-disable-next-line
      feed_url: 'https://dealer.api.leisurevans.com/learn/lessons/feed',
      // eslint-disable-next-line
      site_url: 'https://dealers.leisurevans.com/training',
      generator: 'LTV Dealer API',
      // eslint-disable-next-line
      custom_namespaces: {
        media: 'http://search.yahoo.com/mrss/',
        content: 'http://purl.org/rss/1.0/modules/content/',
      },
    })
    lessons.sort((a, b) => b.publishedAt - a.publishedAt)
    for (let lesson of lessons) {
      const meta = {}
      if (lesson.meta?.videoUrl?.includes('vimeo')) {
        const vimeoId = lesson.meta.videoUrl.split('/').pop()
        const response = await fetch(`https://api.vimeo.com/videos/${vimeoId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${process.env.VIMEO_ACCESS_TOKEN}`,
          },
          params: {
            fields: ['pictures.sizes'],
          },
        })
        const { pictures: thumbs = [] } = await response.json()
        if (thumbs.sizes) {
          const thumb = thumbs.sizes.filter((t) => t.width == 640 && t.height == 360)
          meta.thumb = thumb[0].link_with_play_button
        }
      }

      const content = `<a href="https://dealers.leisurevans.com/training/${lesson.stream}/${lesson.course}/${
        lesson.slug
      }" target="_blank"><img src="${meta.thumb}" /></a>`

      feed.item({
        title: lesson.title,
        ...(lesson.meta.description && { description: lesson.meta.description }),
        url: `https://dealers.leisurevans.com/training/${lesson.stream}/${lesson.course}/${lesson.slug}`,
        date: lesson.publishedAt,
        ...(meta.thumb && {
          // eslint-disable-next-line
          custom_elements: [
            {
              'media:content': [
                {
                  _attr: {
                    url: meta.thumb,
                    medium: 'image',
                    type: 'image/jpg',
                  },
                },
              ],
            },
            {
              'content:encoded': {
                _cdata: content,
              },
            },
          ],
          description: content,
        }),
      })
    }

    let xml = feed.xml()
    res.setHeader('Content-Type', 'application/xml')
    res.setHeader('Cache-Control', 'max-age=0, s-maxage=518400, stale-while-revalidate')
    res.status(200).send(xml)
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Error generating lesson feed.', error: err.message })
  }
}
