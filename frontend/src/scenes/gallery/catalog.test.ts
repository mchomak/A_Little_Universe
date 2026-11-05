import { describe, expect, it } from 'vitest'
import { createGalleryEventMemories, GALLERY_EVENT_ORDER, GALLERY_EVENT_PHOTO_FILES } from './catalog'

describe('gallery event catalogue', () => {
  it('keeps the brief order explicit and stable', () => {
    expect(GALLERY_EVENT_ORDER).toEqual([
      '2024_00_Dimas_Birthday',
      '2025_01_Moscow_City_New_Year',
      '2026_01_Country_House_New_Year',
      '2026_02_23_February_23',
      '2026_03_Movie_Night',
      '2026_04_Theater_Night',
      '2026_04_Artems_Birthday',
      '2026_05_Annas_Graduation',
      '2026_05_Tula_Trip',
      '2026_06_Visiting_Anna',
      '2026_07_World_Cup',
      '2026_07_Club_Night',
      '2026_08_Koh_Samui',
      '2026_08_Timurs_Farewell',
      '2026_09_Annas_Birthday',
      '2026_10_Saint_Petersburg',
      '2026_10_Planetarium',
    ])
  })

  it('uses natural filename order for unnumbered photos and caps each event at four', () => {
    const [memory] = createGalleryEventMemories(
      ['2026_03_Movie_Night'],
      {
        '../../../../images/2026_03_Movie_Night/photo_10.jpg': 'ten',
        '../../../../images/2026_03_Movie_Night/photo_2.jpg': 'two',
        '../../../../images/2026_03_Movie_Night/photo_1.jpg': 'one',
        '../../../../images/2026_03_Movie_Night/photo_3.jpg': 'three',
        '../../../../images/2026_03_Movie_Night/photo_4.jpg': 'four',
        '../../../../images/2026_03_Movie_Night/photo_5.jpg': 'five',
      },
      {},
    )

    expect(memory?.images).toEqual(['one', 'two', 'three', 'four'])
    expect(memory?.image).toBe('one')
  })

  it('skips events without a supported main photo and does not promote numbered extras', () => {
    const memories = createGalleryEventMemories(
      [
        '2025_01_Moscow_City_New_Year',
        '2026_01_Country_House_New_Year',
        '2024_00_Dimas_Birthday',
      ],
      {
        '../../../../images/2025_01_Moscow_City_New_Year/2.jpg': 'moscow-extra',
        '../../../../images/2024_00_Dimas_Birthday/1.jpg': 'dimas-photo',
        '../../../../images/2026_01_Country_House_New_Year/1.mp4': 'video-file',
      },
      { '2024_00_Dimas_Birthday': { title: 'Birthday', caption: 'Birthday memory' } },
    )

    expect(memories.map(({ id }) => id)).toEqual(['2024_00_Dimas_Birthday'])
    expect(memories[0]).toMatchObject({ image: 'dimas-photo', title: 'Birthday', caption: 'Birthday memory' })
  })

  it('adds newly available listed events in order and looks up captions by event ID', () => {
    const newEventId = '2025_01_Moscow_City_New_Year'
    const memories = createGalleryEventMemories(
      GALLERY_EVENT_ORDER,
      {
        '../../../../images/2024_00_Dimas_Birthday/1.jpg': 'dimas-photo',
        [`../../../../images/${newEventId}/1.jpg`]: 'moscow-photo',
        '../../../../images/2026_03_Movie_Night/1.jpg': 'movie-photo',
      },
      {
        [newEventId]: { title: 'Moscow, 2025', caption: 'New year in Moscow' },
        '2026_03_Movie_Night': { title: 'Movie night', caption: '' },
      },
    )

    expect(memories.map(({ id }) => id)).toEqual([
      '2024_00_Dimas_Birthday',
      newEventId,
      '2026_03_Movie_Night',
    ])
    expect(memories.map(({ side, order }) => [side, order])).toEqual([
      [-1, 0],
      [1, 1],
      [-1, 2],
    ])
    expect(memories.map(({ caption }) => caption)).toEqual([
      '',
      'New year in Moscow',
      '',
    ])
    expect(memories.map(({ title }) => title)).toEqual(['', 'Moscow, 2025', 'Movie night'])
  })

  it('keeps a missing numbered slot empty and ignores stale unselected source files', () => {
    const [memory] = createGalleryEventMemories(
      ['2026_07_World_Cup'],
      {
        '../../../../images/2026_07_World_Cup/1.jpg': 'main',
        '../../../../images/2026_07_World_Cup/2.jpg': 'left',
        '../../../../images/2026_07_World_Cup/4.jpg': 'top',
        '../../../../images/2026_07_World_Cup/photo_30.jpg': 'stale-source',
      },
      {},
      { '2026_07_World_Cup': ['1.jpg', '2.jpg', '4.jpg'] },
    )

    expect(memory?.image).toBe('main')
    expect(memory?.images).toEqual(['main', 'left', undefined, 'top'])
  })

  it('builds all 17 events in the declared order when each folder has a main photo', () => {
    const assets = Object.fromEntries(GALLERY_EVENT_ORDER.map((eventId) => [
      `../../../../images/${eventId}/1.jpg`, eventId,
    ]))
    const selections = Object.fromEntries(GALLERY_EVENT_ORDER.map((eventId) => [eventId, ['1.jpg']]))
    const memories = createGalleryEventMemories(GALLERY_EVENT_ORDER, assets, {}, selections)

    expect(memories).toHaveLength(17)
    expect(memories.map(({ id }) => id)).toEqual(GALLERY_EVENT_ORDER)
    expect(memories.map(({ side }) => side)).toEqual(memories.map((_, index) => index % 2 === 0 ? -1 : 1))
  })

  it('keeps one unnumbered selected photo after numbered positions without adding unrelated files', () => {
    const [memory] = createGalleryEventMemories(
      ['2026_04_Theater_Night'],
      {
        '../../../../images/2026_04_Theater_Night/1.jpg': 'main',
        '../../../../images/2026_04_Theater_Night/2.jpg': 'left',
        '../../../../images/2026_04_Theater_Night/3.jpg': 'right',
        '../../../../images/2026_04_Theater_Night/photo_6.jpg': 'selected-top',
        '../../../../images/2026_04_Theater_Night/photo_7.jpg': 'stale-source',
      },
      {},
      { '2026_04_Theater_Night': ['1.jpg', '2.jpg', '3.jpg', 'photo_6.jpg'] },
    )

    expect(memory?.images).toEqual(['main', 'left', 'right', 'selected-top'])
  })

  it('declares selected filenames for the same 17 exact event folders', () => {
    expect(Object.keys(GALLERY_EVENT_PHOTO_FILES)).toEqual(GALLERY_EVENT_ORDER)
    expect(GALLERY_EVENT_ORDER).toHaveLength(17)
    expect(Object.values(GALLERY_EVENT_PHOTO_FILES).every((files) => files.length >= 1 && files.length <= 4)).toBe(true)
  })
})
